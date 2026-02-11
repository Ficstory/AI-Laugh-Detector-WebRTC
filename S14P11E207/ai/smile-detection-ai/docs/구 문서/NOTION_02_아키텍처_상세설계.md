# 모델 아키텍처 상세 설계

작성일: 2026-01-12
버전: v1.0

---

# 🏛️ 전체 시스템 아키텍처

## 시스템 플로우

**클라이언트 (프론트엔드)**

WebRTC Video Stream → Frame Extractor (30 FPS) → Base64 Image

↓ HTTP POST

**FastAPI 서버 (백엔드)**

요청 핸들러 & 프레임 버퍼
- User Buffer 1: [10 frames]
- User Buffer 2: [10 frames]

↓

**AI 모델 (PyTorch)**

INPUT: [Batch, 10, 3, 224, 224]

↓

CNN Feature Extractor (MobileNetV3-Small, Pretrained on ImageNet)

↓ [Batch, 10, 256]

Bidirectional LSTM
- Hidden: 128
- Layers: 2
- Dropout: 0.2

↓ [Batch, 256] (last hidden state)

Classifier Head
- FC(256→64) + ReLU + Dropout(0.5)
- FC(64→2)
- Softmax

↓ [Batch, 2] [No Smile, Smile]

**출력**: {"is_smiling": true, "confidence": 0.87}

---

# 🔍 각 컴포넌트 상세 설계

## 1. 입력 전처리

### 이미지 전처리 파이프라인

**처리 단계**

**Step 1**: Resize to 224x224
- 입력: 가변 크기 (720p/1080p)
- 출력: 224x224

**Step 2**: RGB 변환
- OpenCV는 BGR 사용
- RGB로 변환 필요

**Step 3**: Normalize [0, 255] → [0, 1]
- 픽셀 값을 0-1 범위로 정규화

**Step 4**: ImageNet 표준화
- mean = [0.485, 0.456, 0.406]
- std = [0.229, 0.224, 0.225]

**Step 5**: HWC → CHW
- Height, Width, Channel → Channel, Height, Width
- PyTorch 포맷

### 시퀀스 구성

10개 프레임을 스택:
- 각 프레임: (3, 224, 224)
- 시퀀스: (10, 3, 224, 224)
- 배치 차원 추가: (1, 10, 3, 224, 224)

---

## 2. CNN Feature Extractor

### MobileNetV3-Small 구조

**기본 정보**
- 파라미터 수: 2.5M
- 입력: (224, 224, 3)
- 원본 출력: 1024-dim
- 수정 출력: 256-dim

### 레이어 구조

**Stem**
- Conv 3x3, stride=2
- (3, 224, 224) → (16, 112, 112)

**Block 1**: MBConv, expansion=1
- (16, 112, 112) → (16, 56, 56)

**Block 2**: MBConv, expansion=4
- (16, 56, 56) → (24, 28, 28)

**Block 3**: MBConv, expansion=3
- (24, 28, 28) → (40, 14, 14)

**Block 4**: MBConv, expansion=6
- (40, 14, 14) → (48, 14, 14)

**Block 5**: MBConv, expansion=6
- (48, 14, 14) → (96, 7, 7)

**Head**: Conv 1x1
- (96, 7, 7) → (576, 7, 7)

**Global Average Pooling**
- (576, 7, 7) → (576,)

**Custom Layer**: Linear(576 → 256) + ReLU
- (576,) → (256,)

---

### 우리의 수정사항

Pretrained MobileNetV3 로드 후:

**마지막 분류 레이어 교체**
- 기존: Linear(576 → 1000) for ImageNet
- 수정: Linear(576 → 256) + Hardswish + Dropout(0.3)

목적: 256차원 feature vector 추출

---

### 주요 특징

**1. Squeeze-and-Excitation (SE) 블록**
- 채널 간 중요도 학습
- 중요한 특징 강조

**2. H-Swish 활성화 함수**
- ReLU보다 부드럽고 효율적
- 모바일 환경 최적화

**3. Depthwise Separable Convolution**
- 일반 Convolution보다 연산량 감소
- 성능은 유지

---

### Fine-tuning 전략

**Phase 1: Freeze Backbone**

목적: Pretrained 특징 보존

설정:
- Backbone (features) freeze
- Classifier만 학습
- Learning rate: 1e-3
- Epochs: 10

**Phase 2: Unfreeze All**

목적: End-to-end 학습

설정:
- 전체 네트워크 학습
- Learning rate: 1e-4 (10배 감소)
- Epochs: 30-40

---

## 3. LSTM Temporal Module

### 구조 상세

**설정**
- input_size: 256 (CNN feature dim)
- hidden_size: 128 (LSTM hidden dim)
- num_layers: 2 (Stack 2 LSTM layers)
- batch_first: True (Input: Batch, Seq, Feature)
- dropout: 0.2 (Dropout between LSTM layers)
- bidirectional: True (Forward + Backward)

### 입출력

**입력**: (Batch, Sequence=10, Features=256)

**출력**:
- output: (Batch, Seq, Hidden×2=256)
- h_n: (num_layers×2, Batch, Hidden=128)
- c_n: (num_layers×2, Batch, Hidden=128)

**최종 사용**: output[:, -1, :] → (Batch, 256)
- 마지막 타임스텝의 출력만 사용

---

### Bidirectional LSTM 동작 원리

**시퀀스**: [f1, f2, f3, ..., f10]

**Forward LSTM**
f1 → f2 → f3 → ... → f10 → h_forward (128-dim)

**Backward LSTM**
f10 → f9 → f8 → ... → f1 → h_backward (128-dim)

**최종 출력**
[h_forward; h_backward] (concatenate) → 256-dim

---

### 장점

**미래와 과거 정보 모두 활용**
- Forward: 웃음 시작 감지
- Backward: 웃음 끝 확인
- 양방향 정보로 정확도 향상 (예상 +3~5%)

**웃음 맥락 파악**
- 웃음 전: 중립 표정
- 웃음 중: 입 모양 변화
- 웃음 후: 잔여 미소

---

### Hidden State 초기화

**기본 방식**: Zero initialization (자동)
- h_0 = zeros(num_layers×2, batch, hidden_size)
- c_0 = zeros(num_layers×2, batch, hidden_size)

**학습 가능한 초기화** (옵션):
- 파라미터로 등록하여 학습
- 더 나은 초기 상태 학습 가능

---

## 4. Classifier Head

### 구조

**Layer 1**
- Linear(256 → 64)
- ReLU 활성화
- Dropout(0.5)

**Layer 2 (Output)**
- Linear(64 → 2)
- 출력: [No Smile, Smile] logits

---

### Softmax 및 출력

**학습 시**
- logits 출력
- CrossEntropyLoss 계산 (내부에 Softmax 포함)

**추론 시**
- logits → Softmax → 확률
- 예: [0.13, 0.87] → Smile 확률 87%

---

## 5. 전체 모델 통합

### Forward Pass 흐름

**입력**: (Batch=4, Sequence=10, Channels=3, H=224, W=224)

**Step 1**: CNN 처리를 위한 Reshape
- (4, 10, 3, 224, 224) → (40, 3, 224, 224)
- Batch와 Sequence 차원 병합

**Step 2**: CNN Forward
- (40, 3, 224, 224) → (40, 256)
- 각 프레임 독립적으로 특징 추출

**Step 3**: LSTM 처리를 위한 Reshape
- (40, 256) → (4, 10, 256)
- Batch와 Sequence 차원 복원

**Step 4**: LSTM Forward
- (4, 10, 256) → (4, 10, 256)
- 시간적 패턴 학습

**Step 5**: 마지막 Hidden State 추출
- (4, 10, 256) → (4, 256)
- [:, -1, :] 인덱싱

**Step 6**: Classifier Forward
- (4, 256) → (4, 2)
- 최종 logits 출력

**Step 7**: Softmax
- (4, 2) → 확률
- [[0.92, 0.08], [0.15, 0.85], [0.78, 0.22], [0.05, 0.95]]

---

# 📊 모델 복잡도 분석

## 파라미터 수

| 모듈 | 파라미터 수 | 비율 |
|------|-----------|------|
| MobileNetV3 Backbone | 2,500,000 | 84% |
| MobileNetV3 Classifier (수정) | 150,000 | 5% |
| LSTM (2 layers, bidirectional) | 280,000 | 9% |
| Classifier Head | 50,000 | 2% |
| **Total** | **~3,000,000** | **100%** |

---

## 연산량 (FLOPs)

### 단일 추론당 계산량

**MobileNetV3 (224x224 입력)**: ~60M FLOPs
- 10 프레임: 600M FLOPs

**LSTM (10 timesteps, 256→128)**: ~15M FLOPs

**Classifier**: ~0.5M FLOPs

**Total**: ~615M FLOPs per inference

### 비교 (ImageNet 분류)

| 모델 | FLOPs |
|------|-------|
| ResNet50 | ~4,100M |
| EfficientNet-B0 | ~400M |
| **우리 모델** | **~615M** |

결론: 허용 범위 내

---

## 메모리 사용량

### 모델 가중치

| 정밀도 | 크기 |
|--------|------|
| FP32 | 3M × 4 bytes = 12 MB |
| FP16 | 3M × 2 bytes = 6 MB |
| INT8 | 3M × 1 byte = 3 MB |

### 추론 시 메모리 (Batch=1)

| 항목 | 크기 |
|------|------|
| 입력 텐서 | 10×3×224×224×4 bytes = 6 MB |
| 중간 활성화 | ~20 MB |
| 출력 | < 1 MB |
| **Total** | **~30 MB per user** |

### 다중 사용자

- 10명 동시 접속: ~300 MB
- 100명: ~3 GB (메모리 관리 필요)

---

# ⚡ 추론 속도 최적화

## 1. TorchScript 변환

**방법**: 모델을 TorchScript로 변환

과정:
- model.eval() 모드 설정
- example_input 준비
- torch.jit.trace() 실행
- traced_model.save() 저장

**효과**:
- 속도 향상: 10-30%
- Python 오버헤드 제거
- C++ 런타임에서 실행 가능

---

## 2. Mixed Precision (FP16)

**방법**: AMP (Automatic Mixed Precision)

**효과**:
- 메모리 절약: 50%
- 속도 향상: 20-40% (Tensor Cores 사용 시)

**적용 대상**:
- GPU with Tensor Cores (V100, A100, RTX 시리즈)

---

## 3. 배치 처리

**전략**: 여러 사용자 요청을 배치로 묶기

예시:
- user1_sequence: (10, 3, 224, 224)
- user2_sequence: (10, 3, 224, 224)
- user3_sequence: (10, 3, 224, 224)

묶음:
- batch: (3, 10, 3, 224, 224)
- outputs: (3, 2)

**효과**:
- GPU 활용률 증가
- 전체 처리량 (Throughput) 증가

---

## 4. ONNX Runtime (옵션)

**방법**: PyTorch → ONNX 변환

**효과**:
- 속도 향상: 20-50%
- CPU에서 특히 효과적
- 다양한 플랫폼 지원

**고려사항**:
- 변환 복잡도
- 디버깅 어려움
- 필요 시 적용

---

# 🎓 학습 전략

## 손실 함수

### 기본: CrossEntropyLoss

일반 사용:
- 입력: logits (Batch, 2)
- 타겟: labels (Batch,)
- 출력: loss

### 클래스 불균형 처리

**문제**: 비웃음 70%, 웃음 30%

**해결**: 가중치 부여
- 비웃음: 1.0 (다수 클래스)
- 웃음: 2.3 (소수 클래스, 300/130)

**효과**: 웃음 클래스 학습 강화

---

## Optimizer: Adam

**설정**:
- learning_rate: 1e-3
- weight_decay: 1e-4 (L2 regularization)

**선택 이유**:
- 적응형 학습률
- 빠른 수렴
- 안정적

---

## Learning Rate Scheduler: Cosine Annealing

**설정**:
- T_max: 50 epochs
- eta_min: 1e-6

**동작**:
- 초기: 1e-3
- 중간: 점진적 감소
- 끝: 1e-6

**장점**:
- 부드러운 학습률 감소
- 수렴 안정성
- Local minima 탈출 가능

---

## Early Stopping

**설정**:
- patience: 10 epochs
- min_delta: 0.001

**동작**:
- Validation loss 개선 없으면 카운터 증가
- patience 도달 시 학습 중단
- 최고 성능 모델 저장

**목적**:
- 과적합 방지
- 학습 시간 절약

---

# 🧪 실험 및 검증

## Ablation Study (계획)

각 컴포넌트의 기여도 분석:

| 실험 | 구성 | 예상 정확도 | 목적 |
|------|------|-----------|------|
| Baseline | CNN only (단일 프레임) | 75% | LSTM 필요성 검증 |
| +LSTM | CNN + LSTM | 85% | 시간 정보 효과 |
| +Bidirectional | CNN + BiLSTM | 87% | 양방향 효과 |
| +Data Augmentation | + Aug | 89% | 증강 효과 |
| +Korean Dataset | + Fine-tune | 90%+ | 도메인 적응 효과 |

---

## 하이퍼파라미터 튜닝

### Grid Search 계획

| 파라미터 | 후보 값 | 선택 기준 |
|---------|---------|----------|
| Sequence Length | [5, 10, 15] | 정확도 vs 속도 |
| LSTM Hidden Size | [64, 128, 256] | 성능 vs 메모리 |
| LSTM Layers | [1, 2, 3] | 복잡도 |
| Learning Rate | [1e-2, 1e-3, 1e-4] | 수렴 속도 |
| Batch Size | [16, 32, 64] | GPU 메모리 |
| Dropout | [0.3, 0.5, 0.7] | 과적합 방지 |

---

# 📈 성능 모니터링

## 학습 중 기록할 메트릭

**Training Metrics**:
- train_loss
- train_accuracy

**Validation Metrics**:
- val_loss
- val_accuracy
- val_precision
- val_recall
- val_f1

**Others**:
- learning_rate
- inference_time_ms

**시각화**: TensorBoard

---

## 추론 시 모니터링

### API 서버 메트릭

**성능 지표**:
- total_requests
- avg_inference_time_ms
- p95_latency_ms (95th percentile)
- fps
- errors

**모니터링 도구**:
- Prometheus (메트릭 수집)
- Grafana (실시간 대시보드)

---

# 🔄 버전 관리 및 실험 추적

## 모델 버저닝

**디렉토리 구조**:

models/
- v1.0.0_baseline_mobilenetv3_lstm/
  - model.pth
  - config.yaml
  - metrics.json
  - training_log.txt
- v1.1.0_korean_finetuned/
- v1.2.0_optimized_torchscript/

---

## 실험 추적 (MLflow)

**기록 항목**:

Parameters:
- backbone: mobilenet_v3_small
- lstm_hidden: 128
- sequence_length: 10
- learning_rate: 1e-3

Metrics:
- val_accuracy: 0.87
- val_f1: 0.85
- inference_ms: 12.3

Artifacts:
- model 파일
- config 파일
- 학습 로그

---

# 🎯 다음 단계

## 구현 우선순위

1. ✅ 아키텍처 설계 완료
2. ⏳ 데이터 로더 구현
3. ⏳ 모델 클래스 구현
4. ⏳ 학습 스크립트 작성
5. ⏳ 평가 스크립트 작성
6. ⏳ API 서버 구현

## 검증 계획

- [ ] 단위 테스트 (각 모듈)
- [ ] 통합 테스트 (전체 파이프라인)
- [ ] 성능 벤치마크
- [ ] 실사용 테스트 (팀원들과)

---

작성자: AI 모델 개발자
리뷰어: -
최종 업데이트: 2026-01-12
