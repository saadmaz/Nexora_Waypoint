"""The Pydantic base every API schema inherits: JSON is camelCase, Python is snake_case (Contributing §19)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        use_enum_values=False,
    )


class ErrorBody(ApiModel):
    """The one error shape every route returns."""

    code: str
    message: str
    details: dict | list | None = None
