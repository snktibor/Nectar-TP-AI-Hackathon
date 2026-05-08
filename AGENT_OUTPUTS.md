# Agent Outputs — UI Contract

Reference for the frontend: every agent's runtime output is JSON, served through the standard API envelope on `GET /api/v1/audits/results/{audit_task_id}`. Source of truth: `app/backend/app/models/schemas.py`.

---

## 1. Top-level shape

The audit endpoint always returns the canonical envelope:

```json
{
  "success": true,
  "data": { /* AuditReport — see §2 */ },
  "error": null,
  "meta": {
    "request_id": "8e6d9a44-...-...",
    "timestamp": "2026-05-08T10:14:22Z",
    "api_version": "v1"
  }
}
```

On failure `success: false`, `data: null`, and `error` is filled with `{ code, message, details? }`.

While the audit is still running the UI should poll `GET /api/v1/audits/status/{audit_task_id}`:

```json
{
  "success": true,
  "data": {
    "audit_task_id": "…",
    "session_id": "…",
    "status": "in_progress",
    "progress": 47,
    "stage": "agent:cross_doc_consistency_agent:running",
    "started_at": "2026-05-08T10:13:50Z",
    "updated_at": "2026-05-08T10:14:08Z",
    "error": null,
    "agent_progress": {
      "master_file_agent": "ok",
      "local_file_agent": "running",
      "benchmark_agent": "running",
      "contract_agent": "pending",
      "invoice_agent": "pending",
      "cross_doc_consistency_agent": "running"
    }
  },
  "error": null,
  "meta": { "...": "..." }
}
```

`agent_progress` values: `pending | running | ok | timeout | error`.

---

## 2. `AuditReport` — final aggregated output

```ts
type AuditReport = {
  audit_task_id: string;          // UUID
  session_id: string;             // UUID
  generated_at: string;           // ISO 8601, UTC
  consistency_errors: ConsistencyError[];
  benchmark_risks:    BenchmarkRisk[];
  missing_elements:   MissingElement[];
  overall_risk: "low" | "medium" | "high" | "critical";
  summary: string;                // one-liner: "5/6 agents succeeded; 12 consistency, 3 benchmark, 4 completeness findings."
  agent_runs: AgentRunResult[];   // one entry per agent that ran (success or failure)
};
```

The three finding lists are **flattened across all agents** — each finding carries an `attribution` field that says which agent produced it (see §3).

---

## 3. Shared building blocks

### 3.1 `EvidenceChunk`

Every finding cites at least one chunk that the agent actually retrieved during its run. Hallucinated citations are rejected by the dispatcher. The dispatcher also hydrates each cited chunk with the precise location (`char_start` / `char_end`) and `source_kind` from the original retrieval — the LLM cannot fake or omit these.

```ts
type EvidenceChunk = {
  filename: string;                              // e.g. "MasterFile_2024.pdf" or "32_2017_NGM.pdf"
  page: number;                                  // 0-based page index
  chunk_index: number;                           // 0-based chunk index within the page/doc
  quote?: string | null;                         // ≤ 500 chars verbatim excerpt (optional)
  char_start?: number | null;                    // character offset of the chunk start in the parsed document text
  char_end?: number | null;                      // character offset of the chunk end (exclusive)
  source_kind: "document" | "legal";             // routes click-through: uploaded TP doc viewer vs. legal viewer
};
```

**Click-through / highlight contract** — when the user clicks a finding's citation chip:

1. If `source_kind === "document"` → open the uploaded-document viewer on `filename`, scroll to `page`, and draw a highlight/circle over the substring `[char_start, char_end)` of the parsed document text. The verbatim `quote` is the same text that lives at that range — render it in the panel and use it as a fallback search target if `char_start` / `char_end` are null (legacy chunks).
2. If `source_kind === "legal"` → open the legal-corpus viewer on `filename` (e.g. `32_2017_NGM.pdf`, `OECD_TPG_2022.pdf`, `HU_Act_LXXXI_1996.pdf`), same scroll-and-highlight behaviour. The legal viewer can be a separate tab/panel from the document viewer; routing is driven entirely by `source_kind`.
3. `char_start` / `char_end` are character offsets into the parsed text the chunker produced at ingest, not PDF coordinates. The frontend computes the on-screen highlight by mapping that range to the rendered PDF (text-layer overlay or canvas selection). For chunks without offsets, fall back to a fuzzy search for `quote` on the page.

A finding's citation chips therefore split into two visually-distinct groups:
- **Document evidence** (`source_kind === "document"`) — what's wrong in the package.
- **Legal evidence** (`source_kind === "legal"`) — the regulation/standard that's breached. Render with a different icon (e.g. scale/gavel) so the reviewer immediately sees both anchors.

### 3.2 `FindingAttribution`

Always attached to a real (LLM-emitted) finding so the UI can group by agent, show provenance, and surface the explainability fields the human reviewer relies on.

```ts
type FindingAttribution = {
  agent_id: string;                                       // "master_file_agent" | … | "cross_doc_consistency_agent"
  doc_type_scope:
    | "master_file" | "local_file" | "contract"
    | "benchmark_study" | "invoice" | "other"
    | "cross_document";
  confidence: number;                                     // 0..1, calibrated
  evidence_chunks: EvidenceChunk[];                       // ≥ 1 entry, validated against retrieved chunks
  reasoning?: string | null;                              // ≤ 2000 chars; agent's plain-language inferential chain
  uncertainty_notes?: string | null;                      // ≤ 1000 chars; explicit caveats / ambiguity disclosure
  requires_human_review: boolean;                         // default true; only false for high-confidence + clean legal anchor
  rule_id?: string | null;                                // primary regulation anchor (e.g. "NGM_32_2017.section_4")
  legal_references: string[];                             // additional citations (e.g. ["OECD_TPG_2022.Ch_VI"])
  prompt_version?: string | null;                         // e.g. "master_file_v1"
};
```

**Traceability contract** — every emitted finding must satisfy:

1. `evidence_chunks` is non-empty and every chunk was actually returned by a `search_context` call during the run (the dispatcher rejects hallucinated citations).
2. `reasoning` is non-empty (≥ 20 chars) and explains how the cited evidence supports the finding — UI surfaces it verbatim in the "Miért állapította meg?" / explainability panel.
3. `confidence` is calibrated:
   - `≥ 0.9` → only when the citation directly proves the finding.
   - `0.6 – 0.89` → inferential gap; `requires_human_review` is force-flipped to `true` by the dispatcher.
   - `< 0.5` → not recorded at all.
4. `requires_human_review = false` is allowed only when (a) `confidence ≥ 0.9`, (b) at least one `legal_references` / `rule_id` is cited, and (c) the citation directly proves the finding. The dispatcher enforces (a) automatically.
5. `uncertainty_notes` is filled whenever the agent is aware of ambiguity, missing context, or alternative readings. An empty `uncertainty_notes` is a positive assertion that the agent is NOT aware of caveats.

The frontend MUST render `reasoning`, `uncertainty_notes`, and a visible "human review required" badge whenever `requires_human_review === true`. These fields encode the project's ethical frame: the system supports the expert, it does not replace them.

### 3.3 `ErrorLocation`

```ts
type ErrorLocation = {
  filename: string;
  line_numbers?: number[] | null;
};
```

### 3.4 Severity enum

```ts
type RiskSeverity = "low" | "medium" | "high" | "critical";
```

---

## 4. Finding shapes

Three kinds of finding are emitted by agents. They appear inside `AuditReport` (flattened across agents) and inside each `AgentRunResult` (per-agent only).

### 4.1 `ConsistencyError`

```ts
type ConsistencyError = {
  error_id: string;                       // UUID
  description: string;
  severity: RiskSeverity;
  locations: ErrorLocation[];             // sources involved in the contradiction
  evidence?: string | null;               // optional free-text rationale
  attribution?: FindingAttribution | null;
};
```

### 4.2 `BenchmarkRisk`

```ts
type BenchmarkRisk = {
  risk_id: string;                        // UUID
  metric: string;                         // "operating_margin", "markup", "royalty_rate", …
  observed_value: number;
  benchmark_range: [number, number];      // [low, high] — typically IQR
  severity: RiskSeverity;
  rationale: string;
  locations: ErrorLocation[];
  attribution?: FindingAttribution | null;
};
```

### 4.3 `MissingElement`

```ts
type MissingElement = {
  element_id: string;                     // UUID
  description: string;                    // what's missing
  expected_in: string;                    // "local_file.pdf"
  required_by: string;                    // "32/2017 NGM §4(2)"
  severity: RiskSeverity;
  attribution?: FindingAttribution | null;
};
```

---

## 5. `AgentRunResult` — per-agent telemetry + findings

One entry in `AuditReport.agent_runs` for **every** agent that ran, including timeouts and errors. The UI can use this to show a per-agent strip with status, finding counts, and token spend.

```ts
type AgentRunResult = {
  agent_id: string;
  doc_type_scope: FindingAttribution["doc_type_scope"];
  prompt_version: string;
  model: string;                          // e.g. "claude-sonnet-4-6"
  started_at: string;
  finished_at: string;
  tool_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  consistency_errors: ConsistencyError[];
  benchmark_risks:    BenchmarkRisk[];
  missing_elements:   MissingElement[];
  status: "ok" | "timeout" | "error";
  error?: { code: string; message: string; details?: object | null } | null;
};
```

---

## 6. Agent roster — what each agent emits

All six agents run **in parallel** via `asyncio.gather`. Order in the table below is purely informational.

| `agent_id` | `doc_type_scope` | Primary finding kinds | Notes |
| --- | --- | --- | --- |
| `master_file_agent` | `master_file` | `consistency_error`, `missing_element` | Group-level org chart, intangibles, financing, OECD TPG Ch.V mandatory content |
| `local_file_agent` | `local_file` | `consistency_error`, `missing_element` | Local entity facts, IC transactions, method declared |
| `benchmark_agent` | `benchmark_study` | `benchmark_risk` (primary), `consistency_error` | IQR validation, method coherence |
| `contract_agent` | `contract` | `consistency_error`, occasional `missing_element` | Effective dates, parties, pricing terms |
| `invoice_agent` | `invoice` | `consistency_error` | Reconciles invoice flows against declared transactions |
| `cross_doc_consistency_agent` | `cross_document` | `consistency_error` (primary) | Fan-out across **all** session RAGs + legal corpus; flags contradictions between docs and between a doc and cited law |

Severity rubric (consistent across all agents):

- `critical` — explicit factual contradiction with material tax exposure; mandatory section absent.
- `high` — substantive omission; numeric inconsistency >10 %; conflicting role/function.
- `medium` — partial coverage; ambiguous wording; narrative inconsistency without clear numeric impact.
- `low` — stylistic / cross-reference issues, terminology drift.

Confidence calibration: `0.9+` only when the citations directly prove the finding; `0.6–0.8` for inferential gaps; below `0.5` is not recorded.

---

## 7. Concrete examples

### 7.1 Successful audit — full envelope

```json
{
  "success": true,
  "data": {
    "audit_task_id": "9b8ad0c4-1d8b-4c20-9f3a-30c5b35fe7c8",
    "session_id": "7d2a1e10-9c5e-4f55-8a02-2f1e7b3d4a91",
    "generated_at": "2026-05-08T10:18:42Z",
    "overall_risk": "high",
    "summary": "6/6 agents succeeded; 4 consistency, 2 benchmark, 1 completeness findings.",
    "consistency_errors": [
      {
        "error_id": "1a4f...",
        "description": "Master File names ACME-DE as legal owner of trademark portfolio; Local File schedule 3 lists ACME-HU as owner.",
        "severity": "critical",
        "locations": [
          { "filename": "MasterFile_2024.pdf", "line_numbers": [412, 413] },
          { "filename": "LocalFile_HU_2024.pdf", "line_numbers": [88] }
        ],
        "evidence": "Two documents disagree on intangible legal ownership for FY2024.",
        "attribution": {
          "agent_id": "cross_doc_consistency_agent",
          "doc_type_scope": "cross_document",
          "confidence": 0.95,
          "rule_id": "OECD_TPG_2022.Ch_VI",
          "prompt_version": "cross_doc_consistency_v1",
          "evidence_chunks": [
            { "filename": "MasterFile_2024.pdf", "page": 14, "chunk_index": 3, "quote": "ACME-DE is the registered legal owner of the group trademark portfolio…" },
            { "filename": "LocalFile_HU_2024.pdf", "page": 3,  "chunk_index": 1, "quote": "ACME-HU holds title to the Hungarian and CEE trademarks…" }
          ]
        }
      }
    ],
    "benchmark_risks": [
      {
        "risk_id": "8c2e...",
        "metric": "operating_margin",
        "observed_value": 0.024,
        "benchmark_range": [0.041, 0.087],
        "severity": "high",
        "rationale": "Tested party operating margin (2.4%) is below the IQR low (4.1%) of the comparable set.",
        "locations": [{ "filename": "BenchmarkStudy_2024.xlsx", "line_numbers": null }],
        "attribution": {
          "agent_id": "benchmark_agent",
          "doc_type_scope": "benchmark_study",
          "confidence": 0.88,
          "prompt_version": "benchmark_v1",
          "evidence_chunks": [
            { "filename": "BenchmarkStudy_2024.xlsx", "page": 2, "chunk_index": 0 }
          ]
        }
      }
    ],
    "missing_elements": [
      {
        "element_id": "44f0...",
        "description": "No description of intercompany financial activities (group financing structure).",
        "expected_in": "MasterFile_2024.pdf",
        "required_by": "32/2017 NGM §4(2)(d)",
        "severity": "high",
        "attribution": {
          "agent_id": "master_file_agent",
          "doc_type_scope": "master_file",
          "confidence": 0.82,
          "rule_id": "NGM_32_2017.section_4",
          "prompt_version": "master_file_v1",
          "evidence_chunks": [
            { "filename": "MasterFile_2024.pdf", "page": 22, "chunk_index": 0 }
          ]
        }
      }
    ],
    "agent_runs": [
      {
        "agent_id": "master_file_agent",
        "doc_type_scope": "master_file",
        "prompt_version": "master_file_v1",
        "model": "claude-sonnet-4-6",
        "started_at": "2026-05-08T10:13:50Z",
        "finished_at": "2026-05-08T10:15:01Z",
        "tool_calls": 9,
        "input_tokens": 18420,
        "output_tokens": 1934,
        "cache_read_tokens": 12300,
        "cache_creation_tokens": 6120,
        "consistency_errors": [],
        "benchmark_risks": [],
        "missing_elements": [ /* the missing_element above */ ],
        "status": "ok",
        "error": null
      }
      /* … one entry per agent (master_file, local_file, benchmark, contract, invoice, cross_doc_consistency) … */
    ]
  },
  "error": null,
  "meta": { "request_id": "...", "timestamp": "2026-05-08T10:18:42Z", "api_version": "v1" }
}
```

### 7.2 One agent timed out, audit still completes

```json
{
  "agent_id": "invoice_agent",
  "doc_type_scope": "invoice",
  "prompt_version": "invoice_v1",
  "model": "claude-sonnet-4-6",
  "started_at": "2026-05-08T10:13:50Z",
  "finished_at": "2026-05-08T10:14:50Z",
  "tool_calls": 0,
  "input_tokens": 0,
  "output_tokens": 0,
  "cache_read_tokens": 0,
  "cache_creation_tokens": 0,
  "consistency_errors": [],
  "benchmark_risks": [],
  "missing_elements": [],
  "status": "timeout",
  "error": { "code": "AGENT_TIMEOUT", "message": "Agent exceeded 60s timeout." }
}
```

The aggregated lists at `AuditReport` level simply omit findings from this agent. As long as ≥ 1 agent succeeded, `AuditReport.summary` reports the partial state and `status` of the audit task is `completed` (not `failed`).

### 7.3 All agents failed → audit fails

```json
{
  "success": true,
  "data": {
    "audit_task_id": "…",
    "session_id": "…",
    "status": "failed",
    "progress": 100,
    "stage": "all_agents_failed",
    "error": { "code": "ALL_AGENTS_FAILED", "message": "No specialist agent produced findings." },
    "agent_progress": {
      "master_file_agent": "error",
      "local_file_agent": "error",
      "benchmark_agent": "error",
      "contract_agent": "error",
      "invoice_agent": "error",
      "cross_doc_consistency_agent": "error"
    }
  },
  "error": null,
  "meta": { "...": "..." }
}
```

---

## 8. UI implementation hints

- **Group findings by agent** using `attribution.agent_id` for the dashboard's per-agent panels; flatten by severity for the global risk strip.
- **Severity color tokens** are defined in `phantomDesign` — map `low/medium/high/critical` to those tokens, never invent new ones.
- **Always render at least one citation chip per finding** using `attribution.evidence_chunks[*]` — `filename · p{page} · #chunk_index` plus the optional `quote` in a tooltip. Findings without citations are a backend bug; surface an error badge rather than hiding them.
- **Click-to-highlight** — every chip is clickable. On click: open the appropriate viewer (`source_kind === "document"` → document viewer, `"legal"` → legal viewer), scroll to `page`, and draw a highlight/circle over `[char_start, char_end)`. Fall back to a fuzzy text search for `quote` if `char_start` / `char_end` are null.
- **Split document vs legal chips visually** — group `evidence_chunks` by `source_kind` in the citation panel; legal chips get a regulation icon (scale/gavel) and route to the legal viewer.
- **Reasoning panel** — `attribution.reasoning` MUST be visible (collapsed-by-default expand is fine, hidden is not). This is the "Miért állapította meg?" surface the tax expert audits.
- **Uncertainty banner** — when `attribution.uncertainty_notes` is non-empty, render it next to the reasoning with a distinct (warning-tone, not error-tone) treatment. An empty value means "no known caveats" — render nothing.
- **Human review badge** — when `attribution.requires_human_review === true`, show a prominent badge on the finding card AND filter/sort affordances. Findings with `requires_human_review === false` may be rendered as "system-validated" but never as "auto-accepted".
- **Confidence visualization** — show `attribution.confidence` as a number AND a band (`low <0.6` / `medium 0.6–0.89` / `high ≥0.9`). Never hide it.
- **Legal references** — render `attribution.rule_id` (primary) and each entry in `attribution.legal_references` as separate citation chips, distinguishable from evidence chunks (different icon/color).
- **Per-agent status strip** can be driven entirely by `agent_progress` during polling and by `AuditReport.agent_runs[*].status` once the audit completes.
- **Token spend / latency** for the "telemetry" tab comes from `AgentRunResult` (`input_tokens`, `output_tokens`, `cache_read_tokens`, `started_at`/`finished_at`).
- **Cross-doc findings** (`attribution.agent_id === "cross_doc_consistency_agent"`) typically have ≥ 2 distinct `filename`s in their `evidence_chunks` — render them with a "between docs" visual marker rather than a single-doc one.

---

## 9. Frontend integration file state snapshot (2026-05-09)

- Active render path: `src/App.tsx` → `src/components/DashboardShell.tsx` → `src/components/DocumentIngestor.tsx` + `src/components/AnalysisWorkspace.tsx`.
- `DocumentIngestor.tsx` enforces exactly 5 files per ingest run, validates required type coverage (`master_file`, `local_file`, `contract`, `benchmark_study`, `invoice`), and surfaces failed-file reasons.
- Completed ingest state includes a recovery action (`Fájlok újrafeltöltése`) that resets upload state and reopens file selection.
- `AnalysisWorkspace.tsx` consumes backend audit phases and shows findings, per-agent run data, and telemetry from `AuditReport`.
- `DashboardShell.tsx` sidebar is intentionally local-state navigation only (clickable, no route transition yet).
- `Header.tsx`, `UploadPanel.tsx`, `ResultsPanel.tsx`, and `SeverityBadge.tsx` are currently not on the active render path and should not be used as baseline for new UX behavior.
