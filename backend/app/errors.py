"""One error shape, ``{code, message, details}``, for every failure (PRD §19)."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from waypoint_rules import IllegalTransition


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, details: Any = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details


def unauthenticated(message: str = "Sign in to continue") -> ApiError:
    return ApiError(401, "unauthenticated", message)


def forbidden(message: str = "Your role can't do this") -> ApiError:
    return ApiError(403, "forbidden", message)


def not_found(what: str = "That record") -> ApiError:
    return ApiError(404, "not_found", f"{what} was not found")


def not_implemented(operation: str) -> ApiError:
    """Every route that is in the contract but not built yet raises this."""
    return ApiError(501, "not_implemented", f"{operation} is not built yet", {"operation": operation})


def _body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"code": code, "message": message, "details": details}


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(_body(exc.code, exc.message, exc.details), status_code=exc.status)

    @app.exception_handler(IllegalTransition)
    async def _illegal(_: Request, exc: IllegalTransition) -> JSONResponse:
        details = {"status": exc.status.value, "event": exc.event.value}
        return JSONResponse(_body("illegal_transition", str(exc), details), status_code=409)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
        return JSONResponse(_body("validation_error", "The request is not valid", errors), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return JSONResponse(_body(code, str(exc.detail)), status_code=exc.status_code)
