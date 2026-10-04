"""One error shape, ``{code, message, details}``, for every failure (PRD §19).

Nothing leaves this module as a raw traceback. ``install`` ends with a handler for bare ``Exception``, so a bug in a
service answers ``500 {"code": "internal_error", "details": {"requestId": ...}}`` and the traceback goes to the log under
that same id. Without it Starlette re-raises and the client gets an HTML error page that no frontend can read.
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from waypoint_rules import IllegalTransition

log = logging.getLogger("waypoint.errors")

#: Header carrying the id a client can quote when reporting a failure. Set on every response by ``request_id``.
REQUEST_ID_HEADER = "X-Request-Id"


#: An inbound id is echoed, not trusted: it only correlates a client's report with a log line. It is kept to this
#: alphabet so that a caller cannot put newlines or control characters into a log line and forge an entry.
_SAFE_ID = re.compile(r"[^A-Za-z0-9._-]")


def request_id(request: Request) -> str:
    """The id of the request in flight. Taken from the incoming header when a proxy set one, else minted once."""
    existing = getattr(request.state, "request_id", None)
    if isinstance(existing, str):
        return existing
    inbound = _SAFE_ID.sub("", request.headers.get(REQUEST_ID_HEADER, ""))[:64]
    rid = inbound or uuid.uuid4().hex
    request.state.request_id = rid
    return rid


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

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        """The last resort. The message is deliberately generic: the cause belongs in the log, not in the response."""
        rid = request_id(request)
        log.exception("unhandled error on %s %s (requestId=%s)", request.method, request.url.path, rid)
        return JSONResponse(
            _body("internal_error", "Something went wrong on our side", {"requestId": rid}),
            status_code=500,
            headers={REQUEST_ID_HEADER: rid},
        )
