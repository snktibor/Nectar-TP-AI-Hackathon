"""Mock multi-agent LLM pipeline.

Drives an audit task from PENDING to COMPLETED without calling Anthropic, so
the frontend (and CI) can exercise the full audit UI — including per-agent
progress, attribution, evidence citations, and the cross-document
consistency findings — without burning tokens.

Activate with `REDLINE_USE_REAL_AGENTS=false`. The shape of the returned
`AuditReport` and the polling state is identical to the real orchestrator;
only the contents are fabricated.
"""

from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from app.models.schemas import (
    AgentRunResult,
    AuditReport,
    AuditStatus,
    BenchmarkRisk,
    ConsistencyError,
    DocumentType,
    ErrorDetail,
    ErrorLocation,
    EvidenceChunk,
    FindingAttribution,
    MissingElement,
    RiskSeverity,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Agent identity table — kept in lockstep with `app.agents.AGENT_CLASSES`.
# Centralised here so the mock progress/agent_runs match what the real
# orchestrator would emit.
# ---------------------------------------------------------------------------


_AGENTS: tuple[tuple[str, DocumentType, str], ...] = (
    ("master_file_agent", DocumentType.MASTER_FILE, "master_file_v1"),
    ("local_file_agent", DocumentType.LOCAL_FILE, "local_file_v1"),
    ("benchmark_agent", DocumentType.BENCHMARK_STUDY, "benchmark_v1"),
    ("contract_agent", DocumentType.CONTRACT, "contract_v1"),
    ("invoice_agent", DocumentType.INVOICE, "invoice_v1"),
    ("cross_doc_consistency_agent", DocumentType.CROSS_DOCUMENT, "cross_doc_consistency_v1"),
)

_MOCK_MODEL = "claude-sonnet-4-6-mock"


# ---------------------------------------------------------------------------
# In-memory task registry
# ---------------------------------------------------------------------------


@dataclass
class _TaskState:
    """Mutable per-task record kept in the in-memory registry."""

    audit_task_id: UUID
    session_id: UUID
    status: AuditStatus = AuditStatus.PENDING
    progress: int = 0
    stage: str = "queued"
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    error: ErrorDetail | None = None
    report: AuditReport | None = None
    agent_progress: dict[str, str] = field(
        default_factory=lambda: {agent_id: "pending" for agent_id, _, _ in _AGENTS}
    )


class MockAgentService:
    """Async-safe mock pipeline orchestrator with parity to the real one."""

    def __init__(self, *, total_seconds: float = 18.0) -> None:
        self._tasks: dict[UUID, _TaskState] = {}
        self._lock = asyncio.Lock()
        self._total_seconds = total_seconds

    # -- Public API ---------------------------------------------------------

    async def register_task(self, session_id: UUID) -> UUID:
        """Allocate a new task id in PENDING state."""
        task_id = uuid4()
        async with self._lock:
            self._tasks[task_id] = _TaskState(audit_task_id=task_id, session_id=session_id)
        logger.info(
            "audit task registered task_id=%s session_id=%s mode=mock",
            task_id,
            session_id,
        )
        return task_id

    async def get_task(self, task_id: UUID) -> _TaskState | None:
        async with self._lock:
            return self._tasks.get(task_id)

    async def run_pipeline(self, task_id: UUID) -> None:
        """Background entry point. Drives a task from PENDING to COMPLETED/FAILED."""
        state = await self.get_task(task_id)
        assert state is not None, f"run_pipeline called for unknown task_id={task_id}"
        assert state.status == AuditStatus.PENDING, (
            f"run_pipeline expected PENDING, got {state.status} for task_id={task_id}"
        )

        try:
            await self._update(
                task_id,
                status=AuditStatus.IN_PROGRESS,
                stage="dispatching_agents",
                progress=5,
            )

            # Simulate parallel agent runs: mark each agent "running" up-front,
            # then resolve them in a randomised order so the UI can show staggered
            # completion just like the real asyncio.gather pipeline.
            for agent_id, _, _ in _AGENTS:
                await self._mark_agent(task_id, agent_id, "running")

            order = list(_AGENTS)
            random.shuffle(order)
            per_agent_step = max(1, (95 - 5) // len(order))
            slice_seconds = self._total_seconds / max(len(order), 1)
            for agent_id, _, _ in order:
                await asyncio.sleep(slice_seconds)
                await self._mark_agent(task_id, agent_id, "ok", add_progress=per_agent_step)

            report = self._build_mock_report(state.session_id, task_id, state.started_at)
            await self._update(
                task_id,
                status=AuditStatus.COMPLETED,
                stage="done",
                progress=100,
                report=report,
            )
            logger.info("audit task completed task_id=%s mode=mock", task_id)

        except asyncio.CancelledError:
            await self._update(
                task_id,
                status=AuditStatus.FAILED,
                stage="cancelled",
                error=ErrorDetail(code="TASK_CANCELLED", message="Audit task was cancelled."),
            )
            raise
        except Exception as exc:  # noqa: BLE001 — fail-fast surface for the mock
            logger.exception("audit task crashed task_id=%s", task_id)
            await self._update(
                task_id,
                status=AuditStatus.FAILED,
                stage="error",
                error=ErrorDetail(
                    code="PIPELINE_FAILURE",
                    message="Mock agent pipeline raised an unexpected exception.",
                    details={"exception": type(exc).__name__, "args": [str(a) for a in exc.args]},
                ),
            )

    # -- Internal helpers ---------------------------------------------------

    async def _update(self, task_id: UUID, **changes: object) -> None:
        async with self._lock:
            state = self._tasks.get(task_id)
            if state is None:
                raise KeyError(f"unknown task_id={task_id}")
            for key, value in changes.items():
                setattr(state, key, value)
            state.updated_at = datetime.now(timezone.utc)

    async def _mark_agent(
        self,
        task_id: UUID,
        agent_id: str,
        agent_status: str,
        add_progress: int = 0,
    ) -> None:
        async with self._lock:
            state = self._tasks.get(task_id)
            if state is None:
                return
            state.agent_progress[agent_id] = agent_status
            if add_progress:
                state.progress = min(95, state.progress + add_progress)
                state.stage = f"agent:{agent_id}:{agent_status}"
            state.updated_at = datetime.now(timezone.utc)

    # -- Mock content -------------------------------------------------------

    @staticmethod
    def _build_mock_report(
        session_id: UUID, task_id: UUID, started_at: datetime
    ) -> AuditReport:
        """Build a fully-populated AuditReport that matches the real schema.

        Every finding carries `attribution` with at least one `EvidenceChunk`,
        and `agent_runs` contains one entry per agent in `_AGENTS` so the UI
        can render the per-agent telemetry strip.
        """
        now = datetime.now(timezone.utc)

        # ---- Findings (each tagged to one agent via attribution) ---------------

        master_missing = MissingElement(
            description="Hiányzik a csoportszintű pénzügyi tevékenységek (csoportfinanszírozási struktúra) bemutatása.",
            expected_in="MasterFile_2024.pdf",
            required_by="32/2017 NGM rendelet §4(2)(d)",
            severity=RiskSeverity.HIGH,
            attribution=_attribution(
                "master_file_agent",
                DocumentType.MASTER_FILE,
                confidence=0.82,
                rule_id="NGM_32_2017.section_4",
                legal_references=["NGM_32_2017.section_4(2)(d)", "OECD_TPG_2022.Ch_V"],
                prompt_version="master_file_v1",
                reasoning=(
                    "A 32/2017 NGM rendelet §4(2)(d) pontja kötelezővé teszi a "
                    "csoport pénzügyi tevékenységeinek bemutatását (központi "
                    "finanszírozó entitás, csoportszintű TP politika a pénzügyi "
                    "ügyletekre). A Master File 22. oldali tartalomjegyzéke csak "
                    "az 5. fejezetet (immateriális javak, K+F) említi; sehol nem "
                    "található önálló pénzügyi tevékenységekre vonatkozó fejezet "
                    "vagy érdemi szakasz. Tehát a kötelezően előírt elem hiányzik."
                ),
                uncertainty_notes=(
                    "Nem zárható ki, hogy a pénzügyi tevékenységek leírása "
                    "egy olyan oldalon szerepel, amely az indexelt találatok közé "
                    "nem került be — emberi review-val érdemes ellenőrizni a "
                    "teljes Master File-t a finding megerősítése előtt."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="MasterFile_2024.pdf",
                        page=22,
                        chunk_index=0,
                        char_start=18420,
                        char_end=18642,
                        source_kind="document",
                        quote="Az 5. fejezet a csoport immateriális javait és K+F politikáját tárgyalja…",
                    ),
                    EvidenceChunk(
                        filename="32_2017_NGM.pdf",
                        page=4,
                        chunk_index=2,
                        char_start=2104,
                        char_end=2358,
                        source_kind="legal",
                        quote="§4(2)(d) A pénzügyi tevékenységek leírása, ideértve a központi finanszírozó entitás azonosítását…",
                    ),
                ],
            ),
        )

        local_consistency = ConsistencyError(
            description=(
                "A Local File-ban szereplő működési árrés (4,2%) nem egyezik a "
                "pénzügyi mellékletben kiszámolt értékkel (3,7%)."
            ),
            severity=RiskSeverity.HIGH,
            locations=[
                ErrorLocation(filename="LocalFile_HU_2024.pdf", line_numbers=[12, 15]),
                ErrorLocation(filename="financial_annex.pdf", line_numbers=[8]),
            ],
            evidence="Local File §3.2 vs. II. melléklet 4. táblázat",
            attribution=_attribution(
                "local_file_agent",
                DocumentType.LOCAL_FILE,
                confidence=0.91,
                rule_id="NGM_32_2017.section_5",
                legal_references=["NGM_32_2017.section_5(2)", "OECD_TPG_2022.Ch_V_Annex_II"],
                prompt_version="local_file_v1",
                requires_human_review=True,
                reasoning=(
                    "A Local File §3.2 (3. oldal) explicit módon 4,2%-os "
                    "működési árrést jelent a vizsgált félre 2024-re. A támogató "
                    "pénzügyi melléklet II. melléklet 4. táblázata viszont az "
                    "üzemi eredmény / nettó árbevétel hányadost 3,7%-ban "
                    "számszerűsíti — ugyanarra az időszakra. Az 50 bp eltérés "
                    "(>10% relatív hiba) számszaki ellentmondás a Local File "
                    "narratívája és a saját mellékletének adatai között, ami a "
                    "32/2017 NGM §5(2) pontja szerint a TP elemzéshez használt "
                    "adatok és a könyvelt adatok egyezésének követelményét sérti."
                ),
                uncertainty_notes=(
                    "A két adatpont esetleg eltérő számítási alapon készült "
                    "(pl. egyik a teljes vállalat, másik csak a tesztelt "
                    "tevékenység). A Local File nem tartalmaz erre vonatkozó "
                    "tie-up táblát, ezért nem lehet kizárni egy módszertani "
                    "magyarázatot — emberi szakértői megerősítés szükséges."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="LocalFile_HU_2024.pdf",
                        page=3,
                        chunk_index=2,
                        char_start=4210,
                        char_end=4298,
                        source_kind="document",
                        quote="A vizsgált fél a 2024-es üzleti évben 4,2%-os működési árrést realizált.",
                    ),
                    EvidenceChunk(
                        filename="financial_annex.pdf",
                        page=1,
                        chunk_index=4,
                        char_start=812,
                        char_end=914,
                        source_kind="document",
                        quote="Üzemi eredmény / nettó árbevétel = 3,7% (II. melléklet, 4. táblázat).",
                    ),
                ],
            ),
        )

        benchmark_margin = BenchmarkRisk(
            metric="operating_margin",
            observed_value=0.037,
            benchmark_range=(0.045, 0.078),
            severity=RiskSeverity.HIGH,
            rationale=(
                "A vizsgált fél működési árrése (3,7%) az összehasonlítható "
                "forgalmazói minta interkvartilis tartományának alsó határa (4,5%) alatt van."
            ),
            locations=[
                ErrorLocation(filename="intercompany_contract_2023.pdf", line_numbers=[19, 20]),
            ],
            attribution=_attribution(
                "benchmark_agent",
                DocumentType.BENCHMARK_STUDY,
                confidence=0.88,
                rule_id="OECD_TPG_2022.Ch_III.A",
                legal_references=["OECD_TPG_2022.Ch_III.A.4", "NGM_32_2017.section_6"],
                prompt_version="benchmark_v1",
                reasoning=(
                    "A benchmark study 9 elemű végleges mintát határozott meg, "
                    "melynek interkvartilis tartománya [4,5%; 7,8%]. A vizsgált "
                    "fél tényleges működési árrése (3,7%, a pénzügyi mellékletből) "
                    "az alsó kvartilis (4,5%) alatt van — vagyis a vizsgált fél "
                    "a komparálható minta szokásos piaci tartományán kívül "
                    "teljesít. Az OECD TPG Ch.III.A szerint az IQR-en kívül eső "
                    "értékhez kiigazítás vagy magyarázat szükséges; a "
                    "dokumentációban ilyen nem szerepel."
                ),
                uncertainty_notes=(
                    "A 3,7%-os érték a pénzügyi mellékletből származik, nem a "
                    "Local File narratívájából (ahol 4,2% szerepel). A "
                    "tartomány-eltérés nagysága függ attól, melyik adat a "
                    "valós tesztelt teljesítmény — ezt emberi review-nak kell "
                    "tisztáznia (lásd local_file_agent finding)."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="BenchmarkStudy_2024.xlsx",
                        page=2,
                        chunk_index=0,
                        char_start=1420,
                        char_end=1538,
                        source_kind="document",
                        quote="Végleges összehasonlítható minta: 9 vállalat; IQR [4,5%; 7,8%].",
                    ),
                    EvidenceChunk(
                        filename="financial_annex.pdf",
                        page=1,
                        chunk_index=4,
                        char_start=812,
                        char_end=914,
                        source_kind="document",
                    ),
                    EvidenceChunk(
                        filename="OECD_TPG_2022.pdf",
                        page=104,
                        chunk_index=1,
                        char_start=312_540,
                        char_end=312_812,
                        source_kind="legal",
                        quote="Where the value of the controlled transaction falls outside the arm's-length range, an adjustment is appropriate (Ch.III.A.4).",
                    ),
                ],
            ),
        )

        benchmark_royalty = BenchmarkRisk(
            metric="royalty_rate",
            observed_value=6.0,
            benchmark_range=(2.0, 5.0),
            severity=RiskSeverity.MEDIUM,
            rationale="A jogdíjkulcs (6,0%) meghaladja az összehasonlítható minta felső kvartilisét (5,0%).",
            locations=[
                ErrorLocation(filename="license_agreement.pdf", line_numbers=[7]),
                ErrorLocation(filename="LocalFile_HU_2024.pdf", line_numbers=[55]),
            ],
            attribution=_attribution(
                "benchmark_agent",
                DocumentType.BENCHMARK_STUDY,
                confidence=0.74,
                rule_id="OECD_TPG_2022.Ch_VI.D",
                legal_references=["OECD_TPG_2022.Ch_VI.D.2"],
                prompt_version="benchmark_v1",
                reasoning=(
                    "A licencszerződés 6,0%-os jogdíjkulcsot rögzít, ami a "
                    "benchmark study jogdíj-tartományának [2,0%; 5,0%] felső "
                    "kvartilisét is meghaladja. Mivel a dokumentációban nincs "
                    "magyarázat (pl. egyedi immateriális hozzájárulás) az "
                    "eltérésre, ez piaci tartományon kívüli árazás kockázatát "
                    "hordozza."
                ),
                uncertainty_notes=(
                    "A benchmark study jogdíjmintájához tartozó iparági kódok "
                    "és időszak nem voltak közvetlenül elérhetőek a lekért "
                    "részletekben. Lehetséges hogy a 6,0%-os kulcsot kvalitatív "
                    "összehasonlító elemzés indokolja a study egy másik részében — "
                    "emberi review szükséges."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="license_agreement.pdf",
                        page=1,
                        chunk_index=2,
                        char_start=2240,
                        char_end=2362,
                        source_kind="document",
                        quote="A Licencbe vevő a nettó árbevétel 6,0%-ának megfelelő jogdíjat fizet…",
                    ),
                ],
            ),
        )

        contract_consistency = ConsistencyError(
            description=(
                "A szolgáltatási szerződés hatálya (2024.04.01. – 2025.03.31.) nem fedi "
                "le a 2024. január–márciusban kiszámlázott szolgáltatásokat."
            ),
            severity=RiskSeverity.MEDIUM,
            locations=[
                ErrorLocation(filename="service_agreement.pdf", line_numbers=[3]),
                ErrorLocation(filename="invoice_2024_Q1.pdf", line_numbers=[1]),
            ],
            attribution=_attribution(
                "contract_agent",
                DocumentType.CONTRACT,
                confidence=0.86,
                rule_id="OECD_TPG_2022.Ch_I.D.1",
                legal_references=["OECD_TPG_2022.Ch_I.D.1.2.1"],
                prompt_version="contract_v1",
                reasoning=(
                    "A szolgáltatási szerződés 1. oldali bevezetése szerint a "
                    "hatály 2024. április 1-jén kezdődik. Az invoice_2024_Q1.pdf "
                    "viszont 2024. január–márciusi időszakra kibocsátott "
                    "csoporton belüli szolgáltatási számlákat tartalmaz. "
                    "Az OECD TPG Ch.I.D.1 szerint a kapcsolódó vállalkozások "
                    "közötti tényleges magatartás és a szerződéses feltételek "
                    "időbeli inkonzisztenciája a tranzakció jellegének "
                    "újraértékelését indokolhatja."
                ),
                uncertainty_notes=(
                    "Lehetséges, hogy egy korábbi keretszerződés vagy "
                    "letter-of-intent fedi a Q1-es időszakot — ilyen "
                    "dokumentum a session corpus-ban nem volt fellelhető, "
                    "de a teljes szerződésállomány emberi felülvizsgálata "
                    "ezt megerősítheti vagy cáfolhatja."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="service_agreement.pdf",
                        page=0,
                        chunk_index=0,
                        char_start=120,
                        char_end=242,
                        source_kind="document",
                        quote="Jelen Megállapodás 2024. április 1-jén lép hatályba…",
                    ),
                    EvidenceChunk(
                        filename="invoice_2024_Q1.pdf",
                        page=0,
                        chunk_index=0,
                        char_start=80,
                        char_end=180,
                        source_kind="document",
                        quote="Számla teljesítési időszaka: 2024.01.01. – 2024.03.31.",
                    ),
                ],
            ),
        )

        invoice_consistency = ConsistencyError(
            description=(
                "A Q1–Q4 csoporton belüli szolgáltatási számlák összege (4,82 M EUR) nem "
                "egyezik a Local File-ban deklarált tranzakciós összeggel (5,10 M EUR)."
            ),
            severity=RiskSeverity.MEDIUM,
            locations=[
                ErrorLocation(filename="invoice_2024_Q1.pdf"),
                ErrorLocation(filename="invoice_2024_Q2.pdf"),
                ErrorLocation(filename="invoice_2024_Q3.pdf"),
                ErrorLocation(filename="invoice_2024_Q4.pdf"),
                ErrorLocation(filename="LocalFile_HU_2024.pdf", line_numbers=[71]),
            ],
            attribution=_attribution(
                "invoice_agent",
                DocumentType.INVOICE,
                confidence=0.79,
                rule_id="NGM_32_2017.section_5",
                legal_references=["NGM_32_2017.section_5(2)(c)"],
                prompt_version="invoice_v1",
                reasoning=(
                    "A négy negyedéves csoporton belüli szolgáltatási számla "
                    "(Q1–Q4) összevont végösszege 4 820 000 EUR. A Local File "
                    "4. oldalán deklarált tranzakciós forgalom ugyanerre a "
                    "kategóriára 5 100 000 EUR. A 280 000 EUR (~5,5%) "
                    "egyeztetési hiány a 32/2017 NGM §5(2)(c) szerinti adat-"
                    "egyezőségi követelményt sérti."
                ),
                uncertainty_notes=(
                    "A különbözet adódhat időszaki határátnyúlásból "
                    "(elhatárolás vs. kibocsátás dátum) vagy Q5-be áthúzódó "
                    "tételekből. A korrekciók forrását emberi szakértőnek "
                    "kell tisztáznia a könyvelési kivonatok alapján."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="invoice_2024_Q1.pdf",
                        page=0,
                        chunk_index=0,
                        char_start=80,
                        char_end=180,
                        source_kind="document",
                    ),
                    EvidenceChunk(
                        filename="LocalFile_HU_2024.pdf",
                        page=4,
                        chunk_index=1,
                        char_start=6210,
                        char_end=6308,
                        source_kind="document",
                        quote="A deklarált csoporton belüli szolgáltatási forgalom összesen: 5 100 000 EUR.",
                    ),
                ],
            ),
        )

        crossdoc_consistency = ConsistencyError(
            description=(
                "A Master File az ACME-DE-t nevezi meg a védjegyportfólió jogi "
                "tulajdonosaként; a Local File 3. melléklete ugyanezekre a védjegyekre "
                "az ACME-HU-t jelöli meg jogosultként. Az immateriális javak ellentmondó "
                "tulajdonjoga közvetlen DEMPE-hatással jár."
            ),
            severity=RiskSeverity.CRITICAL,
            locations=[
                ErrorLocation(filename="MasterFile_2024.pdf", line_numbers=[412, 413]),
                ErrorLocation(filename="LocalFile_HU_2024.pdf", line_numbers=[88]),
            ],
            evidence="Két dokumentum eltérően nyilatkozik a 2024-es üzleti évre vonatkozó immateriális jog tulajdonosáról.",
            attribution=_attribution(
                "cross_doc_consistency_agent",
                DocumentType.CROSS_DOCUMENT,
                confidence=0.95,
                rule_id="OECD_TPG_2022.Ch_VI",
                legal_references=[
                    "OECD_TPG_2022.Ch_VI.B.1",
                    "OECD_TPG_2022.Ch_VI.D",
                    "HU_Act_LXXXI_1996.§31_B",
                ],
                prompt_version="cross_doc_consistency_v1",
                requires_human_review=True,
                reasoning=(
                    "A Master File 14. oldal 3. szövegrésze kategorikusan "
                    "kimondja: »Az ACME-DE a csoport védjegyportfóliójának "
                    "bejegyzett jogi tulajdonosa.« Ezzel közvetlenül szembehelyezkedik "
                    "a Local File 3. oldal 1. szövegrésze: »Az ACME-HU a "
                    "magyarországi és KKE-régiós védjegyek jogosultja.« A két "
                    "kijelentés ugyanarra a védjegykörre vonatkozik (»csoport "
                    "védjegyportfólió« vs. »magyarországi és KKE-régiós "
                    "védjegyek«, ami az előbbi részhalmaza), tehát kölcsönösen "
                    "kizáró. Az OECD TPG Ch.VI.B.1 szerint a jogi tulajdonos "
                    "azonosítása a DEMPE-funkció elemzés kiindulópontja, így "
                    "az ellentmondás közvetlen TP allokációs hatással bír, és "
                    "a HU LXXXI/1996 §31/B szerinti dokumentációs kötelezettség "
                    "alapját is megrendíti."
                ),
                uncertainty_notes=(
                    "Nem zárható ki, hogy a két dokumentum eltérő jogi fogalmat "
                    "használ ugyanarra a tényre (pl. »registered owner« vs. "
                    "»economic owner«). A teljes védjegyregiszter és a csoporton "
                    "belüli IP transfer szerződések emberi szakértői "
                    "ellenőrzése a finding megerősítéséhez elengedhetetlen — "
                    "ez critical súlyú, NAV-relevanciájú kockázat."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="MasterFile_2024.pdf",
                        page=14,
                        chunk_index=3,
                        char_start=11_840,
                        char_end=11_948,
                        source_kind="document",
                        quote="Az ACME-DE a csoport védjegyportfóliójának bejegyzett jogi tulajdonosa.",
                    ),
                    EvidenceChunk(
                        filename="LocalFile_HU_2024.pdf",
                        page=3,
                        chunk_index=1,
                        char_start=3_650,
                        char_end=3_752,
                        source_kind="document",
                        quote="Az ACME-HU a magyarországi és KKE-régiós védjegyek jogosultja.",
                    ),
                    EvidenceChunk(
                        filename="OECD_TPG_2022.pdf",
                        page=237,
                        chunk_index=4,
                        char_start=712_010,
                        char_end=712_286,
                        source_kind="legal",
                        quote="Legal ownership alone does not determine entitlement to returns from intangibles (Ch.VI.B.1).",
                    ),
                ],
            ),
        )

        consistency_errors = [local_consistency, contract_consistency, invoice_consistency, crossdoc_consistency]
        benchmark_risks = [benchmark_margin, benchmark_royalty]
        missing_elements = [master_missing]

        # ---- Per-agent run telemetry -----------------------------------------

        def runs_for(agent_id: str) -> tuple[list[ConsistencyError], list[BenchmarkRisk], list[MissingElement]]:
            cons = [c for c in consistency_errors if c.attribution and c.attribution.agent_id == agent_id]
            bench = [b for b in benchmark_risks if b.attribution and b.attribution.agent_id == agent_id]
            miss = [m for m in missing_elements if m.attribution and m.attribution.agent_id == agent_id]
            return cons, bench, miss

        agent_runs: list[AgentRunResult] = []
        finished_at = now
        for idx, (agent_id, doc_type, prompt_version) in enumerate(_AGENTS):
            cons, bench, miss = runs_for(agent_id)
            # Stagger start/finish so a Gantt-style view has variation.
            agent_started = started_at + timedelta(seconds=idx * 0.4)
            agent_finished = finished_at - timedelta(seconds=(len(_AGENTS) - idx - 1) * 0.6)
            tool_calls = 4 + len(cons) * 2 + len(bench) * 2 + len(miss)
            agent_runs.append(
                AgentRunResult(
                    agent_id=agent_id,
                    doc_type_scope=doc_type,
                    prompt_version=prompt_version,
                    model=_MOCK_MODEL,
                    started_at=agent_started,
                    finished_at=agent_finished,
                    tool_calls=tool_calls,
                    input_tokens=12_000 + idx * 400,
                    output_tokens=900 + (len(cons) + len(bench) + len(miss)) * 80,
                    cache_read_tokens=8_000 + idx * 200,
                    cache_creation_tokens=4_000,
                    consistency_errors=cons,
                    benchmark_risks=bench,
                    missing_elements=miss,
                    status="ok",
                    error=None,
                )
            )

        return AuditReport(
            audit_task_id=task_id,
            session_id=session_id,
            generated_at=now,
            consistency_errors=consistency_errors,
            benchmark_risks=benchmark_risks,
            missing_elements=missing_elements,
            overall_risk=RiskSeverity.HIGH,
            summary=(
                f"{len(_AGENTS)}/{len(_AGENTS)} ágens sikeresen lefutott; "
                f"{len(consistency_errors)} konzisztencia-, {len(benchmark_risks)} benchmark- és "
                f"{len(missing_elements)} teljességi megállapítás. Kritikus súlyú "
                "ellentmondás az immateriális javak tulajdonjogában a Master File és a Local File között."
            ),
            agent_runs=agent_runs,
        )


def _attribution(
    agent_id: str,
    doc_type: DocumentType,
    *,
    confidence: float,
    evidence: list[EvidenceChunk],
    reasoning: str,
    prompt_version: str | None = None,
    rule_id: str | None = None,
    legal_references: list[str] | None = None,
    uncertainty_notes: str | None = None,
    requires_human_review: bool | None = None,
) -> FindingAttribution:
    """Build a FindingAttribution with explicit traceability fields.

    `requires_human_review` defaults to True for any finding below 0.9
    confidence, mirroring the dispatcher rule.
    """
    if requires_human_review is None:
        requires_human_review = confidence < 0.9
    return FindingAttribution(
        agent_id=agent_id,
        doc_type_scope=doc_type,
        confidence=confidence,
        evidence_chunks=evidence,
        reasoning=reasoning,
        uncertainty_notes=uncertainty_notes,
        requires_human_review=requires_human_review,
        rule_id=rule_id,
        legal_references=legal_references or [],
        prompt_version=prompt_version,
    )


# Module-level singleton — intentionally simple for the PoC. Wired via DI in
# main.py so endpoints depend on the abstract instance, not the global.
mock_agent_service = MockAgentService()
