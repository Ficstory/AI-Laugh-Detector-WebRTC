"""
Smile Detection FastAPI 서버
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from api.routers import health, analyze, settings
from api.services.model_service import model_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작/종료 시 실행"""
    # 시작 시: 모델 로드
    print("모델 로딩 중...")
    if model_service.load_model():
        print(f"모델 로드 완료! Device: {model_service.get_device()}")
    else:
        print("모델 로드 실패!")

    yield

    # 종료 시
    print("서버 종료")


app = FastAPI(
    title="Smile Detection API",
    description="웃음 감지 AI API 서버",
    version="1.1.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발용: 모든 origin 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(analyze.router, prefix="/api/v1", tags=["Analyze"])
app.include_router(settings.router, prefix="/api/v1", tags=["Settings"])


@app.get("/")
async def root():
    return {"message": "Smile Detection API", "docs": "/docs"}
