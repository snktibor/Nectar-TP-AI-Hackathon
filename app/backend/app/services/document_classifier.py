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


def classify_document(sample_text: str) -> ClassificationResult:
    """Classify document type by matching keyword signals against sample text.

    Uses the ruleset's highest-match-count strategy with priority tiebreak.
    """
    ruleset = _load_ruleset()
    categories = ruleset["categories"]
    rules = ruleset["classification_rules"]
    min_confidence = rules.get("min_confidence_threshold", 0.3)

    text_lower = sample_text.lower()
    best_type = rules["fallback_type"]
    best_label = categories.get(best_type, {}).get("label", "Other")
    best_score = 0
    best_priority = 999
    best_matched: list[str] = []
    max_possible = 1

    for cat_key, cat_config in categories.items():
        keywords: list[str] = cat_config.get("keyword_signals", [])
        if not keywords:
            continue

        matched = [kw for kw in keywords if kw.lower() in text_lower]
        match_count = len(matched)
        min_matches = cat_config.get("min_keyword_matches", 1)
        priority = cat_config.get("priority", 99)

        if match_count < min_matches:
            continue

        total_keywords = len(keywords)
        if total_keywords > max_possible:
            max_possible = total_keywords

        if match_count > best_score or (
            match_count == best_score and priority < best_priority
        ):
            best_type = cat_key
            best_label = cat_config.get("label", cat_key)
            best_score = match_count
            best_priority = priority
            best_matched = matched

    confidence = min(best_score / max(max_possible, 1), 1.0) if best_score > 0 else 0.0

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
        confidence=round(confidence, 3),
        matched_keywords=best_matched,
    )
