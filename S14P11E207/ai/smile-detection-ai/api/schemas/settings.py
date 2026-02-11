from pydantic import BaseModel
from typing import Optional


class Settings(BaseModel):
    smile_threshold: float = 0.18
    max_faces: int = 4


class SettingsUpdate(BaseModel):
    smile_threshold: Optional[float] = None
    max_faces: Optional[int] = None
