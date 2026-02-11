from pydantic import BaseModel
from typing import Optional, Dict, List


class BBox(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int


class SmileResult(BaseModel):
    probability: float
    is_smiling: bool


class EmotionResult(BaseModel):
    label: str
    confidence: float
    all_scores: Dict[str, float]


class FaceResult(BaseModel):
    face_id: int
    bbox: BBox
    smile: SmileResult
    emotion: EmotionResult
    face_image: Optional[str] = None


class AnalyzeResponse(BaseModel):
    faces: List[FaceResult]
    total_faces: int
    processing_time_ms: int


class Base64Request(BaseModel):
    image: str
    threshold: Optional[float] = 0.18
    return_faces: Optional[bool] = False


class BatchFramesRequest(BaseModel):
    """10프레임 배치 요청 (LSTM 시퀀스 입력용)"""
    frames: List[str]  # base64 인코딩된 프레임 리스트
    threshold: Optional[float] = 0.18
    return_faces: Optional[bool] = False


class FrameScore(BaseModel):
    """프레임별 점수"""
    frame: int
    score: float


class BinaryBatchMetadata(BaseModel):
    """Binary 배치 응답 메타데이터"""
    processingTime: float  # ms
    modelVersion: str
    receivedFrames: int
    receivedBytes: int


class BinaryBatchResponse(BaseModel):
    """Binary 배치 분석 응답"""
    success: bool
    isSmiling: bool
    confidence: float
    frameResults: List[FrameScore]
    avgScore: float
    metadata: BinaryBatchMetadata


class BinaryBatchErrorResponse(BaseModel):
    """Binary 배치 에러 응답"""
    success: bool = False
    error: str
    message: str
    receivedShape: Optional[List[int]] = None
