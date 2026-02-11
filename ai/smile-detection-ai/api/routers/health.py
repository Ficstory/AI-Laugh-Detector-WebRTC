from fastapi import APIRouter
from api.schemas.common import success_response
from api.services.model_service import model_service

router = APIRouter()

VERSION = "1.1.0"


@router.get("/health")
async def health_check():
    """서버 상태 확인"""
    return success_response({
        "status": "healthy",
        "model_loaded": model_service.is_loaded(),
        "device": model_service.get_device(),
        "version": VERSION
    })
