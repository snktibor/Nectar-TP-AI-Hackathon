"""Document type classification using keyword-based ruleset matching.

Loads classification rules from rulesets/document_classification.json and
scores the first N pages of extracted text against keyword signals.
Falls back to 'other' when confidence is below threshold.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_RULESET_PATH = Path(__file__).resolve().parents[2] / "rulesets" / "document_classification.json"
_MAX_CLASSIFICATION_CONFIDENCE = 0.99


@dataclass(frozen=True)
class ClassificationResult:
    """Outcome of classifying a single document."""

    doc_type: str
    label: str
    confidence: float
    matched_keywords: list[str]


def _load_ruleset() -> dict:
    with open(_RULESET_PATH, encoding="utf-8") as f:
        return json.load(f)


def _clamp_confidence(value: float) -> float:
    return min(max(value, 0.0), _MAX_CLASSIFICATION_CONFIDENCE)


def classify_document(sample_text: str, filename: str | None = None) -> ClassificationResult:
    """Classify document type by matching keyword signals against sample text.

    Uses the ruleset's highest-match-count strategy with priority tiebreak.
    Confidence is saturation-based: reaches 1.0 once `confidence_saturation`
    distinct keywords are matched, so dense rule lists do not punish scoring.
    """
    ruleset = _load_ruleset()
    categories = ruleset["categories"]
    rules = ruleset["classification_rules"]
    min_confidence = rules.get("min_confidence_threshold", 0.3)
    default_saturation = rules.get("confidence_saturation", 6)
    second_lead_margin = rules.get("second_lead_margin", 0)

    text_lower = sample_text.lower()
    fallback_type = rules["fallback_type"]
    fallback_label = categories.get(fallback_type, {}).get("label", "Other")

    if filename:
        filename_lower = filename.lower()
        for override in rules.get("filename_overrides", []):
            contains_any: list[str] = override.get("contains_any", [])
            matched_token = next((token for token in contains_any if token.lower() in filename_lower), None)
            if matched_token is None:
                continue

            forced_type = override.get("force_type", fallback_type)
            forced_label = categories.get(forced_type, {}).get("label", forced_type)
            return ClassificationResult(
                doc_type=forced_type,
                label=forced_label,
                confidence=round(_clamp_confidence(float(override.get("confidence", 0.95))), 3),
                matched_keywords=[f"filename:{matched_token}"],
            )

    scored: list[tuple[int, int, str, str, list[str], int]] = []
    for cat_key, cat_config in categories.items():
        keywords: list[str] = cat_config.get("keyword_signals", [])
        if not keywords:
            continue

        matched = [kw for kw in keywords if kw.lower() in text_lower]
        match_count = len(matched)
        min_matches = cat_config.get("min_keyword_matches", 1)
        if match_count < min_matches:
            continue

        priority = cat_config.get("priority", 99)
        saturation = cat_config.get("confidence_saturation", default_saturation)
        scored.append((
            match_count,
            -priority,
            cat_key,
            cat_config.get("label", cat_key),
            matched,
            saturation,
        ))

    if not scored:
        return ClassificationResult(
            doc_type=fallback_type,
            label=fallback_label,
            confidence=0.0,
            matched_keywords=[],
        )

    scored.sort(key=lambda r: (r[0], r[1]), reverse=True)
    best_score, _, best_type, best_label, best_matched, best_saturation = scored[0]

    confidence = _clamp_confidence(best_score / max(best_saturation, 1))

    if len(scored) > 1 and second_lead_margin > 0:
        runner_up = scored[1][0]
        if best_score - runner_up < second_lead_margin:
            confidence *= 0.75

    if confidence < min_confidence and best_type != "other":
        return ClassificationResult(
            doc_type="other",
            label="Other",
            confidence=confidence,
            matched_keywords=best_matched,
        )

    return ClassificationResult(
        doc_type=best_type,
        label=best_label,
        confidence=round(_clamp_confidence(confidence), 3),
        matched_keywords=best_matched,
    )
