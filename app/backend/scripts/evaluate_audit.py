"""Compare an audit report against a ground-truth annotations file.

Designed for the HIG hackathon dataset (`datasets/HIG_annotations.json`),
which lists 9 known errors across 5 documents with stable IDs (LF-01,
LF-02, ..., INV-02). For each error this script decides whether the audit
detected it, then reports recall, precision, F1, severity-match rate, and
per-agent breakdown.

Usage
-----
    python -m scripts.evaluate_audit                       # latest audit + default annotations
    python -m scripts.evaluate_audit path/to/audit.json    # specific audit, default annotations
    python -m scripts.evaluate_audit audit.json --annotations other.json

Output
------
* Console: aligned tables (overall, per error_id, per agent, false positives).
* Sidecar JSON: ``audit_reports/eval_<audit_basename>.json`` — machine-readable
  summary suitable for CI tracking or later trend analysis.

Match algorithm
---------------
Each ground-truth error has a manual matcher (keywords + filename hint +
expected `kind`).  A finding "matches" an error_id when:

1. At least one of its citations / locations references the expected file
   (substring match on filename), AND
2. Its description / reasoning / payload contains ANY of the keywords (case
   and accent insensitive), AND
3. (Soft) the kind matches the expected kind — mismatched kind costs a
   match-quality point but does not exclude it.

Multiple findings can match the same error_id (over-confirmation).  A finding
that matches NO error_id is counted as a false positive.
"""

from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ANNOTATIONS = BACKEND_ROOT / "datasets" / "HIG_annotations.json"
DEFAULT_AUDIT_DIR = REPO_ROOT / "audit_reports"


# ---------------------------------------------------------------------------
# Ground-truth matchers — keyed by error_id from HIG_annotations.json.
# Keywords are normalised (lowercase + accent-stripped) at match time.
# ---------------------------------------------------------------------------


@dataclass
class Matcher:
    error_id: str
    filename_hint: str
    keywords_any: tuple[str, ...]
    kind_expected: str
    severity_expected: str
    expected_agent: str


MATCHERS: dict[str, Matcher] = {
    "LF-01": Matcher(
        error_id="LF-01",
        filename_hint="LocalFile",
        keywords_any=(
            "benefit test", "hasznossagi teszt", "hasznossági teszt",
            "menedzsment", "management fee", "menedzsmentszolgaltatasi",
        ),
        kind_expected="missing_element",
        severity_expected="high",
        expected_agent="local_file_agent",
    ),
    "LF-02": Matcher(
        error_id="LF-02",
        filename_hint="LocalFile",
        keywords_any=(
            "dempe", "immaterialis", "immateriális",
            "licencdij", "licencdíj", "know-how", "intangible",
        ),
        kind_expected="missing_element",
        severity_expected="high",
        expected_agent="local_file_agent",
    ),
    "LF-03": Matcher(
        error_id="LF-03",
        filename_hint="LocalFile",
        keywords_any=(
            "funkcionalis", "funkcionális",
            "korlatozott kockazatu", "korlátozott kockázatú",
            "strategiai", "stratégiai",
            "beszallitoi kivalasztas", "beszállítói kiválasztás",
            "kapacitas bovites", "kapacitás bővítés",
        ),
        kind_expected="consistency_error",
        severity_expected="critical",
        expected_agent="local_file_agent",
    ),
    "BENCH-01": Matcher(
        error_id="BENCH-01",
        filename_hint="Benchmark",
        keywords_any=(
            "berry", "1,19", "1.19", "iqr",
            "interkvartilis", "interquartile",
            "q3", "felso kvartilis", "felső kvartilis",
        ),
        kind_expected="benchmark_risk",
        severity_expected="critical",
        expected_agent="benchmark_agent",
    ),
    "BENCH-02": Matcher(
        error_id="BENCH-02",
        filename_hint="Benchmark",
        keywords_any=(
            "cost-plus", "cost plus", "tnmm",
            "haszonkulcs", "modszer", "módszer",
            "1,08", "1.08", "8%",
        ),
        kind_expected="consistency_error",
        severity_expected="medium",
        expected_agent="benchmark_agent",
    ),
    "MGMT-01": Matcher(
        error_id="MGMT-01",
        filename_hint="Contracts",
        keywords_any=(
            "management fee", "menedzsment",
            "teljesitesi kriterium", "teljesítési kritérium",
            "deliverable", "merhetoseg", "mérhetőség",
            "csoportszintu strategiai", "csoportszintű stratégiai",
        ),
        kind_expected="missing_element",
        severity_expected="high",
        expected_agent="contract_agent",
    ),
    "LIC-01": Matcher(
        error_id="LIC-01",
        filename_hint="Contracts",
        keywords_any=(
            "licencdij", "licencdíj",
            "50 000 000", "50.000.000", "50000000", "ötvenmillio", "ötvenmillió",
            "45 000 000", "45.000.000", "45000000",
            "11,1", "11.1",
        ),
        kind_expected="consistency_error",
        severity_expected="critical",
        expected_agent="contract_agent",
    ),
    "INV-01": Matcher(
        error_id="INV-01",
        filename_hint="Invoices",
        keywords_any=(
            "oktober", "október", "december",
            "2024-10-01", "2024.10.01", "2024.12.31",
            "q4", "kiallitas datuma", "kiállítás dátuma",
            "negyedeves szamlazas", "negyedéves számlázás",
            "91 nap",
        ),
        kind_expected="consistency_error",
        severity_expected="medium",
        expected_agent="invoice_agent",
    ),
    "INV-02": Matcher(
        error_id="INV-02",
        filename_hint="Invoices",
        keywords_any=(
            "licencdij szamla", "licencdíj számla", "licencdij",
            "50 000 000", "50.000.000", "50000000",
            "45 000 000", "45.000.000", "45000000",
            "11,1", "11.1",
        ),
        kind_expected="consistency_error",
        severity_expected="critical",
        expected_agent="invoice_agent",
    ),
}


# Cross-doc agent is allowed to also pick up any of these — recall counts it
# as a valid detector for the cross-doc-relevant errors (LF-03, LIC-01, INV-02).
CROSS_DOC_ELIGIBLE: frozenset[str] = frozenset({"LF-03", "LIC-01", "INV-02"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalise(text: str) -> str:
    """Lowercase + strip Hungarian accents for accent-insensitive matching."""
    if not text:
        return ""
    nfd = unicodedata.normalize("NFD", text.lower())
    return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")


def _searchable_text(finding: dict[str, Any]) -> str:
    """Collect every plain-text field that might describe the finding."""
    parts: list[str] = []
    for key in ("description", "evidence", "rationale", "metric"):
        v = finding.get(key)
        if isinstance(v, str):
            parts.append(v)
    attribution = finding.get("attribution") or {}
    for key in ("reasoning", "uncertainty_notes", "rule_id"):
        v = attribution.get(key)
        if isinstance(v, str):
            parts.append(v)
    legal_refs = attribution.get("legal_references")
    if isinstance(legal_refs, list):
        parts.extend(str(x) for x in legal_refs if isinstance(x, str))
    # Citation quotes too — they often contain the smoking-gun phrase.
    for chunk in attribution.get("evidence_chunks") or []:
        if isinstance(chunk, dict):
            quote = chunk.get("quote")
            if isinstance(quote, str):
                parts.append(quote)
    return _normalise(" ".join(parts))


def _filenames_in_finding(finding: dict[str, Any]) -> list[str]:
    """Every filename referenced by this finding (locations + citations)."""
    names: list[str] = []
    for loc in finding.get("locations") or []:
        if isinstance(loc, dict):
            f = loc.get("filename")
            if isinstance(f, str):
                names.append(f)
    attribution = finding.get("attribution") or {}
    for chunk in attribution.get("evidence_chunks") or []:
        if isinstance(chunk, dict):
            f = chunk.get("filename")
            if isinstance(f, str):
                names.append(f)
    return names


def _matches(finding: dict[str, Any], m: Matcher) -> bool:
    """Decide whether ``finding`` plausibly addresses ``m``'s ground-truth error.

    Filename hint is mandatory; at least one keyword must occur in the
    searchable text.  Kind mismatch is permitted but logged as a soft warning
    by the caller.
    """
    files = " ".join(_filenames_in_finding(finding)).lower()
    if m.filename_hint.lower() not in files:
        return False
    text = _searchable_text(finding)
    return any(_normalise(kw) in text for kw in m.keywords_any)


# ---------------------------------------------------------------------------
# Audit traversal
# ---------------------------------------------------------------------------


@dataclass
class Finding:
    agent_id: str
    kind: str
    severity: str
    payload: dict[str, Any]


def _flatten_findings(audit: dict[str, Any]) -> list[Finding]:
    out: list[Finding] = []
    report = audit.get("report") or audit  # support both wrapper and bare report
    for run in report.get("agent_runs") or []:
        if not isinstance(run, dict):
            continue
        agent_id = str(run.get("agent_id") or "?")
        for f in run.get("consistency_errors") or []:
            if isinstance(f, dict):
                out.append(Finding(agent_id, "consistency_error", str(f.get("severity") or ""), f))
        for f in run.get("benchmark_risks") or []:
            if isinstance(f, dict):
                out.append(Finding(agent_id, "benchmark_risk", str(f.get("severity") or ""), f))
        for f in run.get("missing_elements") or []:
            if isinstance(f, dict):
                out.append(Finding(agent_id, "missing_element", str(f.get("severity") or ""), f))
    return out


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------


@dataclass
class ErrorOutcome:
    error_id: str
    detected: bool
    matched_findings: list[Finding] = field(default_factory=list)
    severity_match: bool = False
    kind_match: bool = False
    agent_match: bool = False


@dataclass
class EvalResult:
    audit_path: Path
    annotations_path: Path
    total_findings: int
    total_ground_truth: int
    outcomes: dict[str, ErrorOutcome]
    false_positives: list[Finding]
    per_agent_findings: dict[str, int] = field(default_factory=dict)

    def metrics(self) -> dict[str, float]:
        tp = sum(1 for o in self.outcomes.values() if o.detected)
        fn = self.total_ground_truth - tp
        fp = len(self.false_positives)
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        sev_match = sum(1 for o in self.outcomes.values() if o.detected and o.severity_match)
        sev_acc = sev_match / tp if tp > 0 else 0.0
        return {
            "tp": tp,
            "fn": fn,
            "fp": fp,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "severity_accuracy": sev_acc,
        }


def evaluate(audit_path: Path, annotations_path: Path) -> EvalResult:
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    annotations = json.loads(annotations_path.read_text(encoding="utf-8"))

    findings = _flatten_findings(audit)

    # Build the ground-truth list strictly from the annotations file's summary.
    gt_ids: list[str] = list(annotations.get("summary", {}).get("error_ids") or list(MATCHERS.keys()))

    matched_to_any: set[int] = set()
    outcomes: dict[str, ErrorOutcome] = {}
    for error_id in gt_ids:
        m = MATCHERS.get(error_id)
        if m is None:
            outcomes[error_id] = ErrorOutcome(error_id=error_id, detected=False)
            continue
        matched_findings: list[Finding] = []
        for idx, f in enumerate(findings):
            if not _matches(f.payload, m):
                continue
            matched_findings.append(f)
            matched_to_any.add(idx)
        sev_match = any(
            f.severity.lower() == m.severity_expected.lower() for f in matched_findings
        )
        kind_match = any(f.kind == m.kind_expected for f in matched_findings)
        agent_match = any(
            f.agent_id == m.expected_agent
            or (error_id in CROSS_DOC_ELIGIBLE and f.agent_id == "cross_doc_consistency_agent")
            for f in matched_findings
        )
        outcomes[error_id] = ErrorOutcome(
            error_id=error_id,
            detected=bool(matched_findings),
            matched_findings=matched_findings,
            severity_match=sev_match,
            kind_match=kind_match,
            agent_match=agent_match,
        )

    false_positives = [f for i, f in enumerate(findings) if i not in matched_to_any]

    per_agent: dict[str, int] = {}
    for f in findings:
        per_agent[f.agent_id] = per_agent.get(f.agent_id, 0) + 1

    return EvalResult(
        audit_path=audit_path,
        annotations_path=annotations_path,
        total_findings=len(findings),
        total_ground_truth=len(gt_ids),
        outcomes=outcomes,
        false_positives=false_positives,
        per_agent_findings=per_agent,
    )


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def _print_console(result: EvalResult) -> None:
    m = result.metrics()
    print()
    print(f"Audit:       {result.audit_path}")
    print(f"Annotations: {result.annotations_path}")
    print()
    print("=" * 78)
    print(f"  Recall    {m['recall']:.1%}  ({int(m['tp'])}/{result.total_ground_truth} ground-truth errors detected)")
    print(f"  Precision {m['precision']:.1%}  ({int(m['tp'])}/{result.total_findings} findings on target)")
    print(f"  F1        {m['f1']:.1%}")
    print(f"  Severity  {m['severity_accuracy']:.1%} accurate among detected")
    print("=" * 78)

    print()
    print("Per ground-truth error:")
    print(f"  {'error_id':<10} {'detected':<10} {'kind_ok':<8} {'sev_ok':<7} {'agent_ok':<9} matched_by")
    for eid in sorted(result.outcomes, key=lambda x: (x[:2], x)):
        o = result.outcomes[eid]
        det = "YES" if o.detected else "MISS"
        kind = "yes" if o.kind_match else "no"
        sev = "yes" if o.severity_match else "no"
        agent = "yes" if o.agent_match else "no"
        agents = ",".join(sorted({f.agent_id for f in o.matched_findings})) or "-"
        print(f"  {eid:<10} {det:<10} {kind:<8} {sev:<7} {agent:<9} {agents}")

    print()
    print("Per agent finding count:")
    for a, n in sorted(result.per_agent_findings.items()):
        print(f"  {a:<32} {n}")

    if result.false_positives:
        print()
        print(f"False positives ({len(result.false_positives)}):")
        for f in result.false_positives[:20]:
            descr = (f.payload.get("description") or f.payload.get("rationale") or "")[:90]
            print(f"  [{f.agent_id}] {f.kind}/{f.severity}: {descr}")
        if len(result.false_positives) > 20:
            print(f"  … (+{len(result.false_positives) - 20} more)")
    print()


def _write_sidecar(result: EvalResult) -> Path:
    sidecar = result.audit_path.with_name(f"eval_{result.audit_path.stem}.json")
    payload = {
        "audit_path": str(result.audit_path),
        "annotations_path": str(result.annotations_path),
        "metrics": result.metrics(),
        "total_findings": result.total_findings,
        "total_ground_truth": result.total_ground_truth,
        "per_agent_findings": result.per_agent_findings,
        "outcomes": {
            eid: {
                "detected": o.detected,
                "kind_match": o.kind_match,
                "severity_match": o.severity_match,
                "agent_match": o.agent_match,
                "matched_by": sorted({f.agent_id for f in o.matched_findings}),
                "matched_count": len(o.matched_findings),
            }
            for eid, o in result.outcomes.items()
        },
        "false_positives": [
            {
                "agent_id": f.agent_id,
                "kind": f.kind,
                "severity": f.severity,
                "description": (f.payload.get("description") or f.payload.get("rationale") or "")[:300],
            }
            for f in result.false_positives
        ],
    }
    sidecar.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return sidecar


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def _resolve_audit_path(arg: str | None) -> Path:
    if arg:
        p = Path(arg)
        if not p.is_absolute():
            p = (Path.cwd() / p).resolve()
        if not p.is_file():
            sys.exit(f"audit file not found: {p}")
        return p
    # default: latest *real* audit (skip tiny test artefacts <8KB).
    if not DEFAULT_AUDIT_DIR.is_dir():
        sys.exit(f"default audit directory missing: {DEFAULT_AUDIT_DIR}")
    candidates = sorted(
        (p for p in DEFAULT_AUDIT_DIR.glob("audit_*.json") if p.stat().st_size > 8000),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        sys.exit(f"no audit file ≥8 KB in {DEFAULT_AUDIT_DIR}")
    return candidates[0]


def main(argv: list[str] | None = None) -> int:
    # Force UTF-8 on Windows so accented Hungarian text in findings prints
    # correctly. PowerShell/cmd default to cp1250 which mojibakes ő/ű.
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):
            pass

    parser = argparse.ArgumentParser(
        description="Compare an audit JSON to ground-truth annotations.",
    )
    parser.add_argument(
        "audit",
        nargs="?",
        default=None,
        help="Path to audit_<timestamp>.json (default: latest real audit in audit_reports/)",
    )
    parser.add_argument(
        "--annotations",
        default=str(DEFAULT_ANNOTATIONS),
        help=f"Ground-truth annotations file (default: {DEFAULT_ANNOTATIONS})",
    )
    parser.add_argument(
        "--no-sidecar",
        action="store_true",
        help="Do not write the eval_*.json sidecar next to the audit.",
    )
    args = parser.parse_args(argv)

    audit_path = _resolve_audit_path(args.audit)
    annotations_path = Path(args.annotations)
    if not annotations_path.is_file():
        sys.exit(f"annotations file not found: {annotations_path}")

    result = evaluate(audit_path, annotations_path)
    _print_console(result)

    if not args.no_sidecar:
        sidecar = _write_sidecar(result)
        print(f"Sidecar written: {sidecar}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
