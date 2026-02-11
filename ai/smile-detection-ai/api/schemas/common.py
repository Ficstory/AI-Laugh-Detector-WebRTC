from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime


class ErrorDetail(BaseModel):
    code: str
    message: str


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[ErrorDetail] = None
    timestamp: datetime = None

    def __init__(self, **data):
        if 'timestamp' not in data or data['timestamp'] is None:
            data['timestamp'] = datetime.utcnow()
        super().__init__(**data)


def success_response(data: Any) -> dict:
    return ApiResponse(success=True, data=data).model_dump()


def error_response(code: str, message: str) -> dict:
    return ApiResponse(
        success=False,
        error=ErrorDetail(code=code, message=message)
    ).model_dump()
