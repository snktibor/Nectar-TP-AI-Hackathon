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

        # -- HIG Manufacturing Kft. dataset findings (ground truth: HIG_annotations.json) --

        lf_benefit_test_missing = MissingElement(
            description=(
                "A Local File 4.2. fejezete (Ügylet 2 – Menedzsmentszolgáltatási díj) "
                "nem tartalmaz hasznossági tesztet (benefit test). Az OECD TPG 7.6–7.8. "
                "és a 45/2025. NGM rendelet 6. § (3) bek. alapján kötelező azonosítani, "
                "hogy a fogadó fél számára a szolgáltatás mérhető gazdasági előnnyel "
                "jár-e, amelyet független féltől is megvásárolt volna."
            ),
            expected_in="HIG_LocalFile_2024_FAULTY.pdf",
            required_by="OECD TPG 7.6–7.8; 45/2025. (XII. 23.) NGM rendelet 6. § (3) bek.",
            severity=RiskSeverity.HIGH,
            attribution=_attribution(
                "local_file_agent",
                DocumentType.LOCAL_FILE,
                confidence=0.89,
                rule_id="OECD_TPG_2022.para_7.6-7.8",
                legal_references=["OECD_TPG_2022.para_7.6-7.8", "45_2025_NGM.section_6(3)"],
                prompt_version="local_file_v1",
                reasoning=(
                    "A Local File 4.2. fejezete csupán általánosan utal a "
                    "menedzsment támogatásra ('Az anyavállalat csoportszintű "
                    "menedzsment támogatást nyújt a Társaság részére'), és nem "
                    "tartalmaz konkrét szolgáltatáskategóriákat, piaci "
                    "értékbecslést, sem explicit hasznossági teszt eredményt. "
                    "Az OECD TPG 7.6–7.8. és a 45/2025. NGM rendelet 6. § (3) "
                    "bekezdése szerint a benefit test elvégzése kötelező; "
                    "anélkül a díj levonhatósága adóhatósági vizsgálatban "
                    "kétségbe vonható."
                ),
                uncertainty_notes=(
                    "Nem zárható ki, hogy a benefit test egy más fejezetben "
                    "vagy mellékletben szerepel — emberi review szükséges a "
                    "teljes Local File átvizsgálásához."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="HIG_LocalFile_2024_FAULTY.pdf",
                        page=18,
                        chunk_index=0,
                        char_start=12640,
                        char_end=12716,
                        source_kind="document",
                        quote="Az anyavállalat csoportszintű menedzsment támogatást nyújt a Társaság részére.",
                    ),
                ],
            ),
        )

        lf_dempe_missing = MissingElement(
            description=(
                "A Local File 4.3. fejezete (Ügylet 3 – Licencdíj) nem tartalmaz "
                "DEMPE-elemzést. Az OECD BEPS 8–10. akciópontja és az OECD TPG 6. fejezete "
                "alapján immateriális javakkal kapcsolatos ügyleteknél kötelező megvizsgálni, "
                "melyik entitás végzi az egyes DEMPE-funkciókat (fejlesztés, fokozás, "
                "fenntartás, védelem, hasznosítás)."
            ),
            expected_in="HIG_LocalFile_2024_FAULTY.pdf",
            required_by="OECD TPG Ch. 6, para. 6.32–6.56; BEPS Actions 8–10; 45/2025. NGM rendelet 6. § (4) bek.",
            severity=RiskSeverity.HIGH,
            attribution=_attribution(
                "local_file_agent",
                DocumentType.LOCAL_FILE,
                confidence=0.91,
                rule_id="OECD_TPG_2022.Ch_VI",
                legal_references=[
                    "OECD_TPG_2022.para_6.32-6.56",
                    "BEPS_Actions_8-10",
                    "45_2025_NGM.section_6(4)",
                ],
                prompt_version="local_file_v1",
                reasoning=(
                    "A Local File 4.3. fejezete a licencdíjat egyetlen mondatban "
                    "tárgyalja ('a licencdíj a know-how használatának ellenértéke'), "
                    "és nem elemzi, melyik entitás végzi a DEMPE-funkciókat. Az "
                    "OECD TPG 6. fejezete és a 45/2025. NGM rendelet 6. § (4) "
                    "bekezdése szerint immateriális javakkal kapcsolatos ügyleteknél "
                    "a DEMPE-elemzés elvégzése kötelező; anélkül a licencdíj piaci "
                    "megfelelősége nem igazolható."
                ),
                uncertainty_notes=(
                    "A DEMPE-elemzés esetleg a Master File-ban szerepel — "
                    "emberi review szükséges a csoportszintű dokumentáció "
                    "átvizsgálásához."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="HIG_LocalFile_2024_FAULTY.pdf",
                        page=22,
                        chunk_index=0,
                        char_start=15840,
                        char_end=15890,
                        source_kind="document",
                        quote="a licencdíj a know-how használatának ellenértéke.",
                    ),
                ],
            ),
        )

        mgmt_contract_missing = MissingElement(
            description=(
                "A management fee szerződés (HIG-MGMT-2024-002) 2. §-a a szolgáltatás "
                "tartalmát kizárólag általánosan írja le ('csoportszintű stratégiai és "
                "koordinációs támogatást nyújt'), mérhető teljesítési kritériumok, "
                "konkrét deliverable-ök és minőségi elvárások nélkül. Az OECD TPG "
                "7.14–7.15. bekezdése szerint ez nem elegendő a szokásos piaci ár "
                "elvének igazolásához."
            ),
            expected_in="HIG_Contracts_2024.pdf",
            required_by="OECD TPG 7.6–7.8, 7.14–7.15; 45/2025. NGM rendelet 6. § (3) bek.",
            severity=RiskSeverity.HIGH,
            attribution=_attribution(
                "contract_agent",
                DocumentType.CONTRACT,
                confidence=0.85,
                rule_id="OECD_TPG_2022.para_7.14-7.15",
                legal_references=[
                    "OECD_TPG_2022.para_7.6-7.8",
                    "OECD_TPG_2022.para_7.14-7.15",
                    "45_2025_NGM.section_6(3)",
                ],
                prompt_version="contract_v1",
                reasoning=(
                    "A management fee szerződés 2. §-ában nem szerepelnek "
                    "konkrét szolgáltatáskategóriák (pl. IT-infrastruktúra, "
                    "jogi támogatás, pénzügyi kontrolling), negyedéves "
                    "deliverable-ök, mérhetővé tett teljesítési feltételek, "
                    "sem az Igénybe vevőnél realizálódó mérhető előny leírása. "
                    "Az OECD TPG 7.14–7.15. bekezdése szerint az ilyen általános "
                    "leírás adóhatósági vizsgálatban nem elegendő."
                ),
                uncertainty_notes=(
                    "Lehetséges, hogy egy külön service level agreement (SLA) "
                    "melléklet részletezi a szolgáltatásokat — ilyen a "
                    "corpus-ban nem volt elérhető."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="HIG_Contracts_2024.pdf",
                        page=2,
                        chunk_index=0,
                        char_start=840,
                        char_end=924,
                        source_kind="document",
                        quote="csoportszintű stratégiai és koordinációs támogatást nyújt az Igénybe vevő részére",
                    ),
                ],
            ),
        )

        lf_functional_contradiction = ConsistencyError(
            description=(
                "A Local File 5. fejezete (Funkcionális elemzés) azt állítja, hogy a "
                "HIG Manufacturing Kft. részt vesz a beszállítói kiválasztásban, "
                "önállóan dönt a termelési kapacitás bővítéséről, és aktívan "
                "közreműködik az árstratégia kialakításában. Ez közvetlen ellentmondásban "
                "áll a Master File 1.3. fejezetében és a Local File 2.1. fejezetében "
                "rögzített 'korlátozott kockázatú szerződéses gyártó' profillal."
            ),
            severity=RiskSeverity.CRITICAL,
            locations=[
                ErrorLocation(filename="HIG_LocalFile_2024_FAULTY.pdf"),
                ErrorLocation(filename="HIG_Masterfile_2024.pdf"),
            ],
            evidence="Local File 5. fejezet vs. Master File 1.3. fejezet és Local File 2.1. fejezet",
            attribution=_attribution(
                "local_file_agent",
                DocumentType.LOCAL_FILE,
                confidence=0.96,
                rule_id="OECD_TPG_2022.Ch_I.D.1",
                legal_references=[
                    "OECD_TPG_2022.para_1.51-1.106",
                    "OECD_TPG_2022.para_1.60",
                    "45_2025_NGM.section_4(2)",
                ],
                prompt_version="local_file_v1",
                requires_human_review=True,
                reasoning=(
                    "A Local File 5. fejezet funkcionális elemzése stratégiai "
                    "döntési jogköröket rendel a HIG Manufacturing Kft.-hez "
                    "(beszállítói kiválasztás, kapacitásbővítés, árstratégia). "
                    "Ezzel közvetlen ellentmondásban áll ugyanazon Local File "
                    "2.1. fejezete ('önálló stratégiai döntéshozatali jogköre "
                    "korlátozott') és a Master File 1.3. fejezete ('korlátozott "
                    "kockázatú… Anyavállalat irányítja'). Ha a Társaság valóban "
                    "önálló stratégiai döntéseket hoz, nem minősülhet rutin "
                    "gyártónak, és a cost-plus 8%-os árazás alátámasztottsága "
                    "megkérdőjelezhető."
                ),
                uncertainty_notes=(
                    "Nem zárható ki, hogy az 5. fejezet szövegezése félreérthető "
                    "és operatív (nem stratégiai) döntési jogköröket jelent. "
                    "Emberi szakértői felülvizsgálat szükséges."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="HIG_LocalFile_2024_FAULTY.pdf",
                        page=25,
                        chunk_index=2,
                        char_start=18420,
                        char_end=18578,
                        source_kind="document",
                        quote="részt vesz a beszállítói kiválasztásban, önállóan dönt a termelési kapacitás bővítéséről, és aktívan közreműködik az árstratégia kialakításában",
                    ),
                    EvidenceChunk(
                        filename="HIG_Masterfile_2024.pdf",
                        page=7,
                        chunk_index=1,
                        char_start=5210,
                        char_end=5312,
                        source_kind="document",
                        quote="A HIG Manufacturing Kft. üzleti és pénzügyi kockázatprofilja korlátozott… az Anyavállalat irányítja",
                    ),
                ],
            ),
        )

        lic_royalty_contract_mismatch = ConsistencyError(
            description=(
                "A licencszerződés (HIG-LIC-2024-003) 3. §-a az éves licencdíjat "
                "50 000 000 Ft-ban rögzíti. A Local File 7.1. fejezetében lekönyvelt "
                "összeg 45 000 000 Ft (2,0% × 2 250 000 000 Ft = 45 000 000 Ft). "
                "Az 5 000 000 Ft-os eltérés (11,1%) nem magyarázott."
            ),
            severity=RiskSeverity.CRITICAL,
            locations=[
                ErrorLocation(filename="HIG_Contracts_2024.pdf"),
                ErrorLocation(filename="HIG_LocalFile_2024_FAULTY.pdf"),
            ],
            evidence="Licencszerződés 3. § (50 MFt) vs. Local File 7.1. fejezet (45 MFt)",
            attribution=_attribution(
                "contract_agent",
                DocumentType.CONTRACT,
                confidence=0.94,
                rule_id="OECD_TPG_2022.para_1.10",
                legal_references=["OECD_TPG_2022.para_1.10", "45_2025_NGM.section_3"],
                prompt_version="contract_v1",
                requires_human_review=True,
                reasoning=(
                    "A licencszerződés 3. §-a fix 50 000 000 Ft-os éves licencdíjat "
                    "állapít meg. A Local File 7.1. fejezete 45 000 000 Ft-ot könyvel "
                    "el (2% × 2 250 000 000 = 45 000 000). Az 5 000 000 Ft eltérés "
                    "(11,1%) nem magyarázott; az OECD TPG 1.10. bekezdése szerint a "
                    "tényleges magatartásnak és a szerződéses feltételeknek összhangban "
                    "kell lenniük."
                ),
                uncertainty_notes=(
                    "Lehetséges, hogy a szerződésben rögzített 50 MFt "
                    "minimum-díj alkalmazandó, és a Local File-ban hibás összeg "
                    "szerepel. Könyvelési kivonatok emberi vizsgálata szükséges."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="HIG_Contracts_2024.pdf",
                        page=6,
                        chunk_index=1,
                        char_start=4210,
                        char_end=4298,
                        source_kind="document",
                        quote="A 2024. adóévre vonatkozó éves licencdíj összege: 50 000 000 Ft (ötvenmillió forint)",
                    ),
                    EvidenceChunk(
                        filename="HIG_LocalFile_2024_FAULTY.pdf",
                        page=32,
                        chunk_index=0,
                        char_start=22640,
                        char_end=22710,
                        source_kind="document",
                        quote="licencdíj (HIG Holding GmbH): 45 000 000 Ft",
                    ),
                ],
            ),
        )

        inv_royalty_mismatch = ConsistencyError(
            description=(
                "A licencdíj számla (HIG-LIC-2024-001) nettó összege 50 000 000 Ft, "
                "míg a Local File 4.3. fejezetében számított összeg 2% × 2 250 000 000 "
                "= 45 000 000 Ft. Az 5 000 000 Ft eltérés (11,1%) háromirányú "
                "inkonzisztenciát alkot: szerződés (50 MFt), számla (50 MFt), "
                "Local File (45 MFt)."
            ),
            severity=RiskSeverity.CRITICAL,
            locations=[
                ErrorLocation(filename="HIG_Invoices_2024.pdf"),
                ErrorLocation(filename="HIG_LocalFile_2024_FAULTY.pdf"),
                ErrorLocation(filename="HIG_Contracts_2024.pdf"),
            ],
            evidence="Licencdíj számla (50 MFt) vs. Local File 4.3. fejezet (45 MFt)",
            attribution=_attribution(
                "invoice_agent",
                DocumentType.INVOICE,
                confidence=0.93,
                rule_id="OECD_TPG_2022.para_1.10",
                legal_references=["OECD_TPG_2022.para_1.10", "45_2025_NGM.section_3"],
                prompt_version="invoice_v1",
                requires_human_review=True,
                reasoning=(
                    "A licencdíj számla 50 000 000 Ft-ot tartalmaz. A Local File "
                    "4.3. fejezetének számítása szerint a licencdíj 45 000 000 Ft. "
                    "A 11,1%-os eltérés háromirányú inkonzisztenciát alkot a "
                    "szerződéssel (50 MFt), a számlával (50 MFt) és a Local "
                    "File-lal (45 MFt). Az OECD TPG 1.10. bekezdése szerint "
                    "egységes képet kell mutatniuk."
                ),
                uncertainty_notes=(
                    "Ha a minimum-díjklauzula aktívvá vált, a Local File-t is "
                    "javítani kell. Könyvelési bizonylatok emberi felülvizsgálata "
                    "szükséges."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="HIG_Invoices_2024.pdf",
                        page=7,
                        chunk_index=0,
                        char_start=5840,
                        char_end=5878,
                        source_kind="document",
                        quote="Nettó összeg: 50 000 000 Ft",
                    ),
                    EvidenceChunk(
                        filename="HIG_LocalFile_2024_FAULTY.pdf",
                        page=22,
                        chunk_index=1,
                        char_start=16210,
                        char_end=16250,
                        source_kind="document",
                        quote="2% × 2 250 000 000 = 45 000 000 Ft",
                    ),
                ],
            ),
        )

        inv_date_mismatch = ConsistencyError(
            description=(
                "A Q4 management fee számla (HIG-MGMT-2024-Q4) kiállítási dátuma "
                "2024. október 1., miközben a HIG-MGMT-2024-002 szerződés 4. §-a "
                "szerint a számlázás 'minden negyedév végén' történik "
                "(Q4 esetén: 2024. december 31.). A számla 91 nappal korábban lett "
                "kiállítva, mint a szerződéses határidő."
            ),
            severity=RiskSeverity.MEDIUM,
            locations=[
                ErrorLocation(filename="HIG_Invoices_2024.pdf"),
                ErrorLocation(filename="HIG_Contracts_2024.pdf"),
            ],
            evidence="Számla kiállítása: 2024-10-01 vs. szerződéses számlázási dátum: 2024-12-31 (4. §)",
            attribution=_attribution(
                "invoice_agent",
                DocumentType.INVOICE,
                confidence=0.91,
                rule_id="HU_VAT_Act_CXXVII_2007.section_58",
                legal_references=[
                    "OECD_TPG_2022.para_7.14",
                    "HU_VAT_Act_CXXVII_2007.section_58",
                ],
                prompt_version="invoice_v1",
                reasoning=(
                    "A management fee szerződés 4. §-a egyértelműen rögzíti, "
                    "hogy a Q4-es számla kiállítása december 31-én esedékes. "
                    "A HIG-MGMT-2024-Q4 számlán szereplő 2024. október 1-jei "
                    "kiállítási dátum sérti a teljesítés-alapú számlázás elvét "
                    "(Áfa tv. 58. §) és a szerződéses feltételt."
                ),
                uncertainty_notes=(
                    "Lehetséges, hogy az előre számlázás csoportszintű "
                    "politikából adódik — ilyen kiegészítő megállapodás a "
                    "corpus-ban nem volt fellelhető."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="HIG_Invoices_2024.pdf",
                        page=4,
                        chunk_index=0,
                        char_start=3210,
                        char_end=3248,
                        source_kind="document",
                        quote="Kiállítás dátuma: 2024. október 1.",
                    ),
                    EvidenceChunk(
                        filename="HIG_Contracts_2024.pdf",
                        page=3,
                        chunk_index=1,
                        char_start=2140,
                        char_end=2236,
                        source_kind="document",
                        quote="A számlák kiállításának időpontjai: március 31., június 30., szeptember 30. és december 31.",
                    ),
                ],
            ),
        )

        bench_berry_above_iqr = BenchmarkRisk(
            metric="berry_ratio",
            observed_value=1.19,
            benchmark_range=(1.05, 1.10),
            severity=RiskSeverity.CRITICAL,
            rationale=(
                "A HIG Manufacturing Kft. Berry-rátája (1,19) az összehasonlítható minta "
                "interkvartilis tartományának felső határa (Q3 = 1,10) felett van. "
                "A Benchmark tanulmány 5. fejezetének következtetése ezzel szemben azt "
                "állítja, hogy az érték az IQR-be esik — ez matematikailag téves."
            ),
            locations=[
                ErrorLocation(filename="HIG_Benchmark_2024.pdf"),
            ],
            attribution=_attribution(
                "benchmark_agent",
                DocumentType.BENCHMARK_STUDY,
                confidence=0.98,
                rule_id="OECD_TPG_2022.para_3.57",
                legal_references=[
                    "OECD_TPG_2022.para_3.57",
                    "OECD_TPG_2022.para_3.62",
                    "45_2025_NGM.section_8(3)",
                ],
                prompt_version="benchmark_v1",
                requires_human_review=True,
                reasoning=(
                    "A Benchmark tanulmány IQR-je [1,05; 1,10]. A tesztelt fél "
                    "Berry-rátája 1,19, ami 1,19 > Q3 (1,10) feltétel miatt az "
                    "IQR FELETT van. A tanulmány 5. fejezetének következtetése "
                    "('az interkvartilis tartományba esik') matematikailag téves; "
                    "adóhatósági vizsgálatban az IQR-en kívüli pozíció indoklása "
                    "szükséges."
                ),
                uncertainty_notes=(
                    "A Berry-ráta számításának alapja (teljes vs. tesztelt "
                    "tevékenység) befolyásolhatja az eredményt. Emberi review "
                    "szükséges a minta összetételének ellenőrzéséhez."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="HIG_Benchmark_2024.pdf",
                        page=22,
                        chunk_index=0,
                        char_start=15640,
                        char_end=15784,
                        source_kind="document",
                        quote="A HIG Manufacturing Kft. Berry-rátája az interkvartilis tartományba esik, ezért az alkalmazott árazás szokásos piaci árnak minősül.",
                    ),
                    EvidenceChunk(
                        filename="HIG_Benchmark_2024.pdf",
                        page=18,
                        chunk_index=2,
                        char_start=12840,
                        char_end=12884,
                        source_kind="document",
                        quote="IQR: Q1 = 1,05; Q3 = 1,10; mediána: 1,07",
                    ),
                ],
            ),
        )

        bench_method_mismatch = ConsistencyError(
            description=(
                "A Local File a gyártási ügyletnél cost-plus módszert alkalmaz "
                "8%-os haszonkulccsal (Berry-ráta implikált értéke: 1,08). A Benchmark "
                "tanulmány ugyanakkor TNMM-et alkalmaz Berry-rátával, és a tesztelt fél "
                "Berry-rátáját 1,19-ben állapítja meg. A két érték (1,08 vs. 1,19) "
                "nem konzisztens."
            ),
            severity=RiskSeverity.MEDIUM,
            locations=[
                ErrorLocation(filename="HIG_Benchmark_2024.pdf"),
                ErrorLocation(filename="HIG_LocalFile_2024_FAULTY.pdf"),
            ],
            evidence="Local File cost-plus 8% → Berry-ráta 1,08 vs. Benchmark TNMM Berry-ráta 1,19",
            attribution=_attribution(
                "benchmark_agent",
                DocumentType.BENCHMARK_STUDY,
                confidence=0.87,
                rule_id="OECD_TPG_2022.para_2.59",
                legal_references=["OECD_TPG_2022.para_2.59", "45_2025_NGM.section_7(1)"],
                prompt_version="benchmark_v1",
                reasoning=(
                    "Ha a Local File cost-plus 8%-os haszonkulcsot alkalmaz, "
                    "akkor a tesztelt fél Berry-rátája matematikailag 1 + 0,08 = "
                    "1,08. A Benchmark azonban 1,19-es Berry-rátát mutat a "
                    "tesztelt félre, ami ~19%-os implikált cost-plus haszonkulcsnak "
                    "felel meg. Az OECD TPG 2.59. bekezdése szerint a módszer és "
                    "a tesztelt eredmény konzisztenciája kötelező."
                ),
                uncertainty_notes=(
                    "Lehetséges, hogy a Benchmark a TNMM-et és a cost-plus "
                    "módszert párhuzamosan teszteli. Emberi felülvizsgálat "
                    "szükséges."
                ),
                evidence=[
                    EvidenceChunk(
                        filename="HIG_LocalFile_2024_FAULTY.pdf",
                        page=18,
                        chunk_index=2,
                        char_start=12840,
                        char_end=12966,
                        source_kind="document",
                        quote="A Társaság elsődleges transzferár-módszerként a Cost-Plus módszert alkalmazza 8%-os haszonkulccsal.",
                    ),
                    EvidenceChunk(
                        filename="HIG_Benchmark_2024.pdf",
                        page=14,
                        chunk_index=1,
                        char_start=9840,
                        char_end=9902,
                        source_kind="document",
                        quote="a HIG Manufacturing Kft. 2024. évi tényleges Berry-rátája … 1,19",
                    ),
                ],
            ),
        )

        consistency_errors = [
            lf_functional_contradiction,
            lic_royalty_contract_mismatch,
            inv_royalty_mismatch,
            inv_date_mismatch,
            bench_method_mismatch,
        ]
        benchmark_risks = [bench_berry_above_iqr]
        missing_elements = [lf_benefit_test_missing, lf_dempe_missing, mgmt_contract_missing]

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
            overall_risk=RiskSeverity.CRITICAL,
            summary=(
                f"{len(_AGENTS)}/{len(_AGENTS)} ágens sikeresen lefutott; "
                f"{len(consistency_errors)} konzisztencia-, {len(benchmark_risks)} benchmark- és "
                f"{len(missing_elements)} teljességi megállapítás. 4 kritikus súlyú finding: "
                "a Berry-ráta (1,19) az IQR felső határa (1,10) felett van, de a Benchmark "
                "téves következtetéssel szokásos piaci árnak minősíti; háromirányú "
                "licencdíj-összegeltérés (szerződés/számla: 50 MFt vs. Local File: 45 MFt); "
                "a funkcionális elemzés korlátozott kockázatú profillal ellentétes stratégiai "
                "döntési jogköröket rendel a HIG Manufacturing Kft.-hez."
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
