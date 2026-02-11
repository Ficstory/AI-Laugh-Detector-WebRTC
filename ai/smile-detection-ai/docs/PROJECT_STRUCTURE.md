# 프로젝트 구조

> Claude가 코드 읽기 전에 먼저 참조하는 파일

---

## 폴더 구조

```
ai/smile-detection-ai/
├── api/                    # FastAPI 서버
├── checkpoints/            # PyTorch 체크포인트 (.pth)
├── data/                   # 데이터셋
│   ├── collected/          # 파인튜닝용 학습 데이터
│   └── eval/               # 평가용 데이터 (80개 시퀀스)
├── docs/                   # 문서
├── models/                 # 배포용 ONNX 모델
├── scripts/                # 유틸리티 스크립트
├── src/                    # 핵심 소스코드 (모델 정의, 학습 로직)
├── venv/                   # 가상환경
│
├── config.yaml             # 학습 설정
├── README.md               # 프로젝트 설명
├── requirements.txt        # Python 의존성
├── test_webcam.py          # 웹캠 테스트
└── train.py                # 학습 진입점
```

---

## 주요 파일/폴더 역할

### 루트 파일

| 파일 | 역할 | 실행 방법 |
|------|------|-----------|
| `train.py` | 모델 학습 진입점 | `python train.py` |
| `test_webcam.py` | 웹캠으로 실시간 테스트 | `python test_webcam.py` |
| `config.yaml` | 학습 하이퍼파라미터 설정 | - |

### scripts/

| 파일 | 역할 | 실행 방법 |
|------|------|-----------|
| `collect_data.py` | 웹캠 데이터 수집 (9초 촬영) | `python scripts/collect_data.py` |
| `visualize_data.py` | 수집 데이터 시각화/검증 | `python scripts/visualize_data.py` |
| `evaluate_baseline.py` | ONNX 모델 성능 평가 | `python scripts/evaluate_baseline.py` |
| `export_onnx.py` | PyTorch → ONNX 변환 | `python scripts/export_onnx.py` |

### src/

| 폴더 | 역할 |
|------|------|
| `src/models/` | 모델 아키텍처 정의 (Y자형 듀얼헤드) |
| `src/training/` | 학습 로직 (trainer, loss) |
| `src/data/` | 데이터셋 로더 |
| `src/utils/` | 유틸리티 (config, metrics) |

### 모델 파일

| 경로 | 역할 |
|------|------|
| `checkpoints/best_model.pth` | Baseline PyTorch 가중치 |
| `models/smile_detector.onnx` | Baseline ONNX 모델 (배포용) |

### 데이터

| 경로 | 역할 |
|------|------|
| `data/collected/` | 파인튜닝용 학습 데이터 |
| `data/eval/` | 평가용 데이터 (Baseline 측정에 사용) |

---

## FastAPI 서버

```
api/
├── main.py                 # 서버 진입점
├── routers/
│   ├── health.py           # GET /health
│   └── analyze.py          # POST /analyze/binary-batch
├── schemas/
│   └── analyze.py          # 요청/응답 스키마
└── services/
    └── model_service.py    # 모델 로딩/추론
```

### 서버 실행
```bash
cd ai/smile-detection-ai
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### API 문서
- Swagger UI: http://localhost:8000/docs
- 상세 명세: `docs/API_SPEC.md`

---

## 파인튜닝 워크플로우

1. **데이터 수집**: `python scripts/collect_data.py`
2. **데이터 검증**: `python scripts/visualize_data.py`
3. **파인튜닝**: `python scripts/finetune.py` (작성 예정)
4. **ONNX 변환**: `python scripts/export_onnx.py`
5. **성능 평가**: `python scripts/evaluate_baseline.py -m models/finetuned.onnx`

---

*최종 수정: 2025-01-22*
