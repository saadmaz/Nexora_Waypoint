"""One structured log line per request, and the request id that ties a log line to the error a client saw.

A failure in the field is reported as "it said something went wrong". The id in that response body is in exactly one log
line, with the method, the path, the status and how long it took, so the line can be found without guessing the minute.

Kept deliberately small: a dict rendered as ``key=value`` pairs, not a logging framework. A real deployment points
``LOG_FORMAT`` at a JSON formatter and these same fields come out as JSON, because they are passed as ``extra``.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .errors import REQUEST_ID_HEADER, request_id

log = logging.getLogger("waypoint.request")

#: Paths that say nothing worth a line each time: the probes a load balancer hits every few seconds.
QUIET = frozenset({"/api/v1/health", "/api/v1/health/live", "/api/v1/health/ready"})


class RequestLog(BaseHTTPMiddleware):
    """Log every request once it is answered, and put its id on the response.

    An exception is logged with the same id and re-raised, so the handler in ``errors`` still shapes the body and the
    test client still sees the real traceback.
    """

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        rid = request_id(request)
        started = time.perf_counter()
        quiet = request.url.path in QUIET
        try:
            response = await call_next(request)
        except Exception:
            # Logged here as well as in the handler: the handler does not run when the test client re-raises.
            log.exception(
                "request failed", extra=self._fields(request, rid, 500, time.perf_counter() - started)
            )
            raise
        response.headers[REQUEST_ID_HEADER] = rid
        if not (quiet and response.status_code < 400):
            fields = self._fields(request, rid, response.status_code, time.perf_counter() - started)
            level = logging.WARNING if response.status_code >= 500 else logging.INFO
            log.log(level, " ".join(f"{k}={v}" for k, v in fields.items()), extra=fields)
        return response

    @staticmethod
    def _fields(request: Request, rid: str, status: int, seconds: float) -> dict[str, object]:
        return {
            "requestId": rid,
            "method": request.method,
            "path": request.url.path,
            "status": status,
            "ms": round(seconds * 1000, 1),
        }
