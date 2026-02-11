from fastapi import APIRouter

from api.schemas.common import success_response
from api.schemas.settings import SettingsUpdate
from api.services.model_service import model_service

router = APIRouter()


@router.get("/settings")
async def get_settings():
    """현재 설정 조회"""
    return success_response(model_service.get_settings())


@router.patch("/settings")
async def update_settings(updates: SettingsUpdate):
    """설정 변경"""
    update_dict = updates.model_dump(exclude_none=True)
    updated = model_service.update_settings(update_dict)
    return success_response(updated)
