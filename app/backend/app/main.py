"""FastAPI application entry point.

Wires routers, CORS, structured logging, and — most importantly — installs
exception handlers that force every error response through the standardized
envelope defined in `app.models.schemas.ApiResponse`.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.endpoints import audits, documents
from app.core.logging import configure_logging
from app.core.settings import get_settings
from app.models.schemas import ApiResponse, ErrorDetail, ResponseMeta

logger = logging.getLogger(__name__)
configure_logging(get_settings())


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def _envelope_error(
    code: str,
    message: str,
    http_status: int,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    """Build a JSONResponse that conforms to the standardized envelope."""
    body = ApiResponse[None](
        success=False,
        data=None,
        error=ErrorDetail(code=code, message=message, details=details),
        meta=ResponseMeta(),
    )
    return JSONResponse(status_code=http_status, content=jsonable_encoder(body))


def create_app() -> FastAPI:
    app = FastAPI(
        title="Transfer Pricing Audit AI — API",
        version="1.0.0",
        description=(
            "Asynchronous polling API for the multi-agent Transfer Pricing audit "
            "pipeline. All responses follow a standardized envelope: "
            "{success, data, error, meta}."
        ),
    )

    # CORS — permissive defaults for the PoC; tighten origins before production.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---- Routers -----------------------------------------------------------
    api_v1_prefix = "/api/v1"
    app.include_router(documents.router, prefix=api_v1_prefix)
    app.include_router(audits.router, prefix=api_v1_prefix)

    # ---- Health probe ------------------------------------------------------
    @app.get("/health", tags=["system"], response_model=ApiResponse[dict[str, str]])
    async def health() -> ApiResponse[dict[str, str]]:
        return ApiResponse[dict[str, str]](success=True, data={"status": "ok"})

    # ---- Exception handlers (envelope enforcement) -------------------------
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        # Endpoints raise HTTPException with detail={"code", "message", "details"}.
        # Accept plain-string details too for safety.
        if isinstance(exc.detail, dict) and "code" in exc.detail and "message" in exc.detail:
            return _envelope_error(
                code=str(exc.detail["code"]),
                message=str(exc.detail["message"]),
                http_status=exc.status_code,
                details=exc.detail.get("details"),
            )
        return _envelope_error(
            code=f"HTTP_{exc.status_code}",
            message=str(exc.detail) if exc.detail else "HTTP error.",
            http_status=exc.status_code,
        )

    @app.exception_handler(HTTPException)
    async def fastapi_http_exception_handler(
        request: Request, exc: HTTPException
    ) -> JSONResponse:
        # FastAPI's HTTPException is a subclass of Starlette's, but registering
        # this explicitly avoids any ordering surprises.
        return await http_exception_handler(request, exc)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return _envelope_error(
            code="VALIDATION_ERROR",
            message="Request payload failed validation.",
            http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={"errors": jsonable_encoder(exc.errors())},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        _request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception("unhandled exception: %s", exc)
        return _envelope_error(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred.",
            http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details={"exception": type(exc).__name__},
        )

    return app


app = create_app()
