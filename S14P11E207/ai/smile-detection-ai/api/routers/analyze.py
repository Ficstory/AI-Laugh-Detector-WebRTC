from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request, Header
from typing import Optional
import cv2
import numpy as np

from api.schemas.common import success_response, error_response
from api.schemas.analyze import Base64Request, BatchFramesRequest, BinaryBatchResponse, BinaryBatchErrorResponse
from api.services.model_service import model_service

router = APIRouter()


@router.post("/analyze/image")
async def analyze_image(
    image: UploadFile = File(...),
    threshold: Optional[float] = Form(0.18),
    return_faces: Optional[bool] = Form(False)
):
    """이미지 파일에서 웃음/감정 분석"""
    if not model_service.is_loaded():
        raise HTTPException(status_code=500, detail=error_response("MODEL_ERROR", "모델이 로드되지 않았습니다"))

    # 이미지 읽기
    try:
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail=error_response("INVALID_IMAGE", "유효하지 않은 이미지 형식입니다"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=error_response("INVALID_IMAGE", f"이미지 읽기 실패: {str(e)}"))

    # 분석
    try:
        result = model_service.analyze_image(img, threshold, return_faces)

        if result["total_faces"] == 0:
            raise HTTPException(status_code=400, detail=error_response("NO_FACE_DETECTED", "얼굴이 탐지되지 않았습니다"))

        return success_response(result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=error_response("MODEL_ERROR", f"분석 실패: {str(e)}"))


@router.post("/analyze/base64")
async def analyze_base64(request: Base64Request):
    """Base64 인코딩된 이미지에서 웃음/감정 분석"""
    if not model_service.is_loaded():
        raise HTTPException(status_code=500, detail=error_response("MODEL_ERROR", "모델이 로드되지 않았습니다"))

    # 이미지 디코딩
    try:
        img = model_service.decode_base64_image(request.image)

        if img is None:
            raise HTTPException(status_code=400, detail=error_response("INVALID_IMAGE", "유효하지 않은 이미지 형식입니다"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=error_response("INVALID_IMAGE", f"Base64 디코딩 실패: {str(e)}"))

    # 분석
    try:
        result = model_service.analyze_image(img, request.threshold, request.return_faces)

        if result["total_faces"] == 0:
            raise HTTPException(status_code=400, detail=error_response("NO_FACE_DETECTED", "얼굴이 탐지되지 않았습니다"))

        return success_response(result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=error_response("MODEL_ERROR", f"분석 실패: {str(e)}"))


@router.post("/analyze/batch")
async def analyze_batch(request: BatchFramesRequest):
    """
    프레임 시퀀스 배치 분석 (Y자형 듀얼헤드)

    - 10프레임을 한 번에 받아서 LSTM으로 시간적 패턴 분석
    - Smile Head: 시퀀스 전체의 웃음 확률
    - Emotion Head: 마지막 프레임 기준 감정 분류
    """
    if not model_service.is_loaded():
        raise HTTPException(status_code=500, detail=error_response("MODEL_ERROR", "모델이 로드되지 않았습니다"))

    if not request.frames:
        raise HTTPException(status_code=400, detail=error_response("INVALID_IMAGE", "프레임이 비어있습니다"))

    # 프레임 디코딩
    try:
        frames = []
        for i, frame_b64 in enumerate(request.frames):
            img = model_service.decode_base64_image(frame_b64)
            if img is None:
                raise HTTPException(
                    status_code=400,
                    detail=error_response("INVALID_IMAGE", f"프레임 {i} 디코딩 실패")
                )
            frames.append(img)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=error_response("INVALID_IMAGE", f"프레임 디코딩 실패: {str(e)}"))

    # 시퀀스 분석
    try:
        result = model_service.analyze_sequence(frames, request.threshold, request.return_faces)

        if result.get("sequence_length", 0) == 0:
            raise HTTPException(status_code=400, detail=error_response("NO_FACE_DETECTED", "얼굴이 탐지되지 않았습니다"))

        return success_response(result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=error_response("MODEL_ERROR", f"분석 실패: {str(e)}"))


@router.post("/analyze/binary-batch", response_model=BinaryBatchResponse)
async def analyze_binary_batch(
    request: Request,
    x_tensor_shape: str = Header(..., description="텐서 shape (예: 1,10,3,224,224)"),
    x_tensor_dtype: str = Header(default="float32", description="데이터 타입"),
    x_timestamp: Optional[str] = Header(default=None, description="클라이언트 타임스탬프"),
    threshold: Optional[float] = Header(default=0.18, description="웃음 판정 임계값")
):
    """
    Binary 텐서 배치 분석 (프로덕션용)

    - Content-Type: application/octet-stream
    - Body: Float32Array.buffer (정규화 완료된 텐서)
    - Shape: (1, 10, 3, 224, 224)
    """
    if not model_service.is_loaded():
        return BinaryBatchErrorResponse(
            error="MODEL_ERROR",
            message="모델이 로드되지 않았습니다"
        )

    # shape 파싱
    try:
        shape = tuple(map(int, x_tensor_shape.split(',')))
        if len(shape) != 5:
            return BinaryBatchErrorResponse(
                error="InvalidTensorShape",
                message=f"Expected 5D shape, got {len(shape)}D",
                receivedShape=list(shape)
            )
    except ValueError as e:
        return BinaryBatchErrorResponse(
            error="InvalidTensorShape",
            message=f"Shape 파싱 실패: {str(e)}"
        )

    # body 읽기
    try:
        body = await request.body()
        expected_bytes = np.prod(shape) * 4  # float32 = 4 bytes

        if len(body) != expected_bytes:
            return BinaryBatchErrorResponse(
                error="InvalidTensorSize",
                message=f"Expected {expected_bytes} bytes, got {len(body)} bytes",
                receivedShape=list(shape)
            )
    except Exception as e:
        return BinaryBatchErrorResponse(
            error="ReadError",
            message=f"Body 읽기 실패: {str(e)}"
        )

    # 분석
    try:
        result = model_service.analyze_binary_batch(body, shape, threshold)
        return BinaryBatchResponse(**result)
    except Exception as e:
        return BinaryBatchErrorResponse(
            error="MODEL_ERROR",
            message=f"분석 실패: {str(e)}"
        )
