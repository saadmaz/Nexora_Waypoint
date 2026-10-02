from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.types import Text

#: All times are timestamptz (UTC in the database, shown in Asia/Colombo).
TZ = DateTime(timezone=True)
TEXT_ARRAY = ARRAY(Text)
JSON = JSONB


def enum_col(e: type[StrEnum], name: str) -> Enum:
    """Store the enum's value (``"deferred"``), checked by a CHECK constraint, not a PG enum type.

    Non-native enums keep migrations simple when a value is added mid-hackathon.
    """
    return Enum(e, name=name, native_enum=False, create_constraint=True, length=32,
                values_callable=lambda x: [m.value for m in x])


__all__ = ["TZ", "TEXT_ARRAY", "JSON", "enum_col", "datetime"]
