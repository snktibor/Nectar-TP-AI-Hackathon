"""External tax-number / VAT verification service.

EU counterparties → live VIES REST API (no auth required).
HU counterparties → NAV mock (no technical user key available for the hackathon).
"""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger("redline.services.tax_api")

_VIES_BASE = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{cc}/vat/{vat}"
_TIMEOUT = 10.0


async def verify_tax_number(country_code: str, vat_number: str) -> dict[str, object]:
    """Return a validation result dict for the given tax / VAT number.

    Keys: is_valid (bool), company_name (str), company_address (str), source (str).
    """
    cc = country_code.upper().strip()
    vat = vat_number.strip()

    if cc == "HU":
        return _mock_nav(vat)

    return await _query_vies(cc, vat)


# ---------------------------------------------------------------------------
# Hungarian NAV — mock (no technical user key for hackathon)
# ---------------------------------------------------------------------------


def _mock_nav(vat_number: str) -> dict[str, object]:
    invalid = vat_number.startswith("999")
    return {
        "is_valid": not invalid,
        "company_name": "" if invalid else "Hungarian Entity (mock)",
        "company_address": "" if invalid else "Hungary (mock)",
        "source": "NAV_API_MOCK",
    }


# ---------------------------------------------------------------------------
# EU VIES REST API — live
# ---------------------------------------------------------------------------


async def _query_vies(country_code: str, vat_number: str) -> dict[str, object]:
    url = _VIES_BASE.format(cc=country_code, vat=vat_number)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("VIES HTTP error %s for %s%s", exc.response.status_code, country_code, vat_number)
        return _vies_error_result(country_code, vat_number, f"HTTP {exc.response.status_code}")
    except httpx.RequestError as exc:
        logger.warning("VIES request error for %s%s: %s", country_code, vat_number, exc)
        return _vies_error_result(country_code, vat_number, str(exc))

    is_valid: bool = bool(data.get("isValid", False))
    company_name: str = data.get("name") or ""
    company_address: str = data.get("address") or ""

    return {
        "is_valid": is_valid,
        "company_name": company_name,
        "company_address": company_address,
        "source": "EU_VIES_API_LIVE",
    }


def _vies_error_result(country_code: str, vat_number: str, reason: str) -> dict[str, object]:
    return {
        "is_valid": False,
        "company_name": "",
        "company_address": "",
        "source": "EU_VIES_API_LIVE",
        "error": f"Registry lookup failed for {country_code}{vat_number}: {reason}",
    }
