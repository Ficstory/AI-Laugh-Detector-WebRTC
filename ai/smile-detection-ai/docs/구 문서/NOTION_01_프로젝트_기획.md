# 웃음 감지 AI 모델 - 프로젝트 기획서

작성일: 2026-01-12
프로젝트명: 실시간 웃음 감지 시스템 (개그배틀용)

---

# 📋 프로젝트 개요

## 목적
실시간 화상통화 중 참가자의 얼굴을 추적하여 웃음 여부를 자동으로 판별하는 AI 시스템 개발

## 배경
- 게임 컨셉: 개그배틀 - 먼저 웃는 사람이 지는 게임
- 기술 요구사항: 실시간 화상통화 환경에서 30 FPS 이상의 속도로 웃음 감지
- 타겟 사용자: 한국인 사용자

---

# 🎯 핵심 요구사항

## 기능적 요구사항
1. 실시간 처리: 30 FPS 비디오 스트림에서 실시간 웃음 감지
2. 높은 정확도: 거짓 양성/음성 최소화 (게임 공정성)
3. 낮은 레이턴시: 사용자가 지연을 느끼지 않을 것 (< 50ms)
4. 안정성: 다양한 조명, 각도, 얼굴 방향에서 동작

## 비기능적 요구사항
1. 경량화: 서버 리소스 효율적 사용
2. 확장성: 다중 사용자 동시 처리 가능
3. 유지보수성: 모델 업데이트 및 개선 용이

---

# 🏗️ 기술 스택 선정

## 딥러닝 프레임워크: PyTorch

선택 이유:
- 연구 및 프로토타입 개발에 유리
- 동적 그래프로 디버깅 쉬움
- TorchScript로 프로덕션 배포 가능
- 풍부한 커뮤니티와 사전학습 모델

## 백엔드 프레임워크: FastAPI

선택 이유:
- 비동기 처리로 다중 요청 효율적 처리
- WebSocket 지원
- 자동 API 문서화
- 빠른 성능 (Starlette 기반)

## 컴퓨터 비전 라이브러리
- OpenCV: 비디오/이미지 처리
- MediaPipe: 얼굴 랜드마크 추출 (옵션)

---

# 🤖 모델 아키텍처 설계

## 아키텍처 비교 분석

| 아키텍처 | 추론 속도 | 정확도 | 모델 크기 | 시간적 패턴 학습 | 선택 여부 |
|---------|----------|--------|----------|----------------|---------|
| CNN 단독 | 200+ FPS | 중간 | 5-20MB | 약함 | ❌ |
| **CNN + LSTM** | **150+ FPS** | **높음** | **10-50MB** | **강함** | **✅** |
| Transformer | 30-60 FPS | 매우 높음 | 100-500MB | 매우 강함 | ❌ |
| 3D CNN | 50-80 FPS | 높음 | 50-200MB | 강함 | ❌ |

## 최종 선택: CNN + LSTM Hybrid

---

# 📌 왜 CNN + LSTM인가?

## 1. 실시간 성능

목표: 30 FPS 이상 처리 → 프레임당 33ms 이내 추론

- CNN + LSTM: 5-15ms/프레임 → ✅ 목표 달성
- Transformer: 30-100ms/프레임 → ❌ 레이턴시 초과

## 2. 웃음 감지 특성 분석

- 웃음은 0.5~2초 동안 지속되는 짧은 이벤트
- 30 FPS 기준 15~60 프레임 시퀀스
- 이 정도 짧은 시퀀스는 LSTM으로 충분
- Transformer는 긴 컨텍스트(수백 프레임)에서 강점 → 오버킬

## 3. 연산 복잡도

- Self-Attention (Transformer): O(n²) - n은 시퀀스 길이
- LSTM: O(n) - 순차 처리지만 n이 작으면 효율적

## 4. 학습 데이터 요구량

- Transformer: 대규모 데이터셋 필요 (수십만~수백만 샘플)
- CNN + LSTM: 중간 규모로도 학습 가능 (수만 샘플)
- 자체 데이터 수집을 고려하면 CNN + LSTM이 현실적

## 5. 모델 크기 및 메모리

- CNN + LSTM: 10-50MB
- Transformer: 100-500MB+
- 서버 효율성 및 여러 사용자 동시 처리를 위해 경량 모델 선호

---

# 🎨 상세 아키텍처 설계

## 전체 파이프라인

입력 비디오 프레임 (720p/1080p)
↓
[1] 전처리 (Resize to 224x224, Normalize)
↓
[2] CNN Feature Extractor (MobileNetV3-Small)
↓ (256-dim feature vector)
[3] LSTM Temporal Modeling (Sequence of 10 frames)
↓ (128-dim hidden state)
[4] Fully Connected Classifier
↓
출력: [웃음 확률: 0.0 ~ 1.0]

---

# 🔧 Stage 1: CNN Backbone

## 선택한 백본: MobileNetV3-Small

### 백본 비교

| 모델 | 파라미터 | 모델 크기 | 추론 속도 | 정확도 | 선택 여부 |
|------|---------|----------|----------|--------|---------|
| **MobileNetV3-Small** | **2.5M** | **2.5MB** | **200+ FPS** | **중상** | **✅** |
| MobileNetV3-Large | 5.4M | 5.5MB | 150 FPS | 상 | ⭐ 대안 |
| EfficientNet-B0 | 5.3M | 20MB | 80 FPS | 매우 높음 | ❌ |
| ResNet18 | 11M | 45MB | 100 FPS | 상 | ❌ |

### MobileNetV3-Small 선택 이유

1. 초경량: 2.5MB로 메모리 효율적
2. 빠른 속도: 200+ FPS로 실시간 처리 여유
3. 충분한 성능: 얼굴 감정 인식에 충분한 특징 추출 능력
4. 모바일 최적화: 향후 모바일 앱 확장 가능

### 구조

- ImageNet Pretrained 가중치 사용
- 마지막 분류 레이어 제거
- 출력: 256차원 feature vector

### Fine-tuning 전략

- 초기: Backbone freeze, Classifier만 학습
- 이후: 전체 네트워크 fine-tuning (learning rate 낮춤)

---

# 🔄 Stage 2: LSTM Temporal Module

## 설정

- Hidden size: 128
- Num layers: 2
- Bidirectional: True → 출력 256차원
- Dropout: 0.2 (과적합 방지)

## 시퀀스 길이: 10 프레임

### 시퀀스 길이 결정 근거

| 시퀀스 길이 | 시간 (30 FPS) | 장점 | 단점 | 선택 여부 |
|-----------|--------------|------|------|---------|
| 5 프레임 | 0.17초 | 빠른 응답 | 웃음 감지 어려움 | ❌ |
| **10 프레임** | **0.33초** | **균형잡힌 성능** | **없음** | **✅** |
| 15 프레임 | 0.5초 | 높은 정확도 | 반응 느림 | ❌ |
| 20 프레임 | 0.67초 | 매우 높은 정확도 | 레이턴시 과다 | ❌ |

### 10 프레임 선택 이유

1. 웃음 초기 감지: 웃음 시작 후 0.33초면 충분히 감지 가능
2. 게임 공정성: 너무 빠르면 오탐, 너무 느리면 불공평
3. 연산 효율: LSTM 연산량과 정확도의 최적 균형점

---

# 📊 데이터셋 전략

## 문제 인식: 한국인 데이터 부족

### 왜 한국인 데이터가 중요한가?

**1. 얼굴 구조 차이**
- 동양인 vs 서양인: 눈꺼풀 구조, 광대뼈 위치 다름
- 눈 크기 및 모양 차이

**2. 표정 표현 방식 차이**
- 서양: 이를 많이 드러내는 웃음
- 동양: 입 모양 변화 중심, 눈 변화 (눈웃음)

**3. 문화적 차이**
- 억제된 미소 vs 활짝 웃음
- 손으로 입 가리는 습관

---

## 공개 데이터셋 조사

| 데이터셋 | 샘플 수 | 해상도 | 동양인 비율 | 표정 종류 | 사용 가능성 |
|---------|---------|--------|-----------|----------|-----------|
| FER2013 | 35,887 | 48x48 | ~15% | 7가지 | 🟡 Pretrain용 |
| CK+ | 593 | 640x490 | ~10% | 8가지 | 🟡 보조 |
| AffectNet | 1M+ | 다양 | ~20% | 8가지 | 🟢 Pretrain용 |
| KDEF | 4,900 | 562x762 | 0% | 7가지 | 🔴 부적합 |
| AI Hub (한국) | ? | ? | 100% | ? | 🟢 확인 필요 |

---

## 최종 데이터 전략: 3단계 하이브리드 접근 ✅

### Phase 1: Pretrain (공개 데이터셋)

- 데이터셋: AffectNet + FER2013
- 목적: 기본적인 얼굴 표정 특징 학습
- 학습 방식: Happy vs Non-Happy 이진 분류로 재라벨링
- 예상 성능: 70-80% 정확도 (서양인 위주 데이터)

### Phase 2: Fine-tuning (자체 수집 한국인 데이터)

**수집 계획**

참가자: 팀원 + 지인 20-30명

촬영 환경:
- 웹캠으로 화상통화 환경 재현
- 다양한 조명 (자연광, 실내등, 어두운 환경)
- 정면, 약간 측면 각도

촬영 시나리오:
1. 중립 표정 유지 (2분) - 비웃음 데이터
2. 재미있는 영상 시청 (5분) - 자연스러운 웃음
3. 일부러 웃기 (1분) - 과장된 웃음

데이터량 계산:
- 1인당 8분 × 30 FPS = 14,400 프레임
- 30명 × 14,400 = 432,000 프레임
- 비웃음: ~300,000 프레임 (70%)
- 웃음: ~130,000 프레임 (30%)

**라벨링 방법**
- VLC Media Player로 비디오 재생
- 웃음 구간 타임스탬프 기록 (CSV)
- 자동 스크립트로 프레임 추출 및 라벨 부여

**학습 방식**
- Phase 1 모델 가중치 로드
- 한국인 데이터로 fine-tuning
- Learning rate 낮춤 (1e-4)

### Phase 3: 지속적 개선 (Active Learning)

- 실제 사용 중 오류 케이스 수집
- 사용자 피드백으로 라벨 보정
- 주기적으로 모델 재학습

---

## 데이터 증강 전략

화상통화 환경의 다양성 반영:

**기하학적 변환**
- horizontal_flip: 0.5 (좌우 반전)
- rotation: ±15도 (고개 기울임)
- scale: 0.9 ~ 1.1 (카메라 거리 변화)

**색상/조명 변화**
- brightness: 0.8 ~ 1.2 (조명 변화)
- contrast: 0.8 ~ 1.2 (명암비)
- saturation: 0.8 ~ 1.2 (채도)

**노이즈 추가**
- gaussian_noise: σ=0.01 (웹캠 노이즈)
- motion_blur: 가끔 (움직임 흐림)

**화상통화 특화**
- jpeg_compression: 70-100 (압축 아티팩트)
- resize_artifacts: 가끔 (해상도 변화)

---

## 데이터 분할

- Train: 70% (302,400 프레임)
- Validation: 15% (64,800 프레임)
- Test: 15% (64,800 프레임)

**중요**: 사람 단위로 분할 (같은 사람이 train/test에 섞이지 않게)

---

# 🎯 성능 목표 및 평가 지표

## 목표 성능

| 지표 | 목표 값 | 측정 방법 | 중요도 |
|------|---------|----------|--------|
| Accuracy | ≥ 85% | 전체 정확도 | ⭐⭐⭐ |
| **Recall (웃음 감지율)** | **≥ 90%** | **실제 웃음을 놓치지 않음** | **⭐⭐⭐⭐⭐** |
| Precision | ≥ 85% | 거짓 양성 최소화 | ⭐⭐⭐⭐ |
| F1 Score | ≥ 87% | 균형잡힌 성능 | ⭐⭐⭐⭐ |
| Inference Time | ≤ 30ms | GPU 기준 | ⭐⭐⭐⭐⭐ |
| FPS | ≥ 30 | 실시간 처리 | ⭐⭐⭐⭐⭐ |

---

## Recall이 가장 중요한 이유

**게임 공정성 관점**

시나리오 1: False Negative (Recall 문제)
- 실제: 웃음 😊
- 예측: 비웃음
- 결과: 웃었는데 감지 못함 → 게임 불공평! ❌❌❌

시나리오 2: False Positive (Precision 문제)
- 실제: 비웃음 😐
- 예측: 웃음
- 결과: 억울하지만 조심하면 됨 → 상대적으로 덜 심각 ⚠️

---

## 평가 전략

**1. Offline 평가**
- Test set에서 Confusion Matrix 분석
- ROC Curve, AUC 측정
- 다양한 threshold에서 성능 비교

**2. Online 평가 (실사용 테스트)**
- 팀원들과 실제 게임 플레이
- 오탐/미탐 케이스 기록
- 사용자 경험 피드백

**3. Edge Case 테스트**
- 안경 착용
- 마스크 착용 (입만 가린 경우)
- 어두운 조명
- 측면 각도
- 과장된 표정

---

# ⚡ 실시간 처리 시스템 설계

## 역할 분담

### AI 모델 (당신 담당)

**입력**: 224x224 RGB 이미지 (단일 프레임)

**출력**: JSON 응답

예시:
- is_smiling: true
- confidence: 0.87
- inference_time_ms: 12.3

**처리 시간 보장**: < 30ms

### 프론트엔드/웹소켓 (팀원 담당)

- WebRTC로 비디오 스트림 수신
- 30 FPS로 프레임 캡처
- Canvas API로 프레임 추출
- Base64 인코딩 후 API 전송
- 결과 UI 업데이트

---

## API 설계

### Endpoint 1: 단일 프레임 예측

**요청**
- Method: POST
- URL: /api/v1/predict
- Content-Type: application/json

요청 본문:
- image: base64_encoded_jpeg
- user_id: user_123
- timestamp: 1234567890

**응답**
- is_smiling: true
- confidence: 0.87
- inference_time_ms: 12.3
- model_version: v1.0.0

---

## LSTM 시퀀스 처리 전략

### 문제

LSTM은 10프레임 시퀀스가 필요하지만, 클라이언트는 1프레임씩 전송

### 해결책: 서버 측 프레임 버퍼링 ✅

각 사용자별로 최근 10프레임 큐를 유지:
- user_123: [frame1, frame2, ..., frame10]
- user_456: [frame1, frame2, ..., frame10]

새 프레임 도착 시:
1. 버퍼에 추가
2. 10프레임 미만이면 "warming up" 응답
3. 10프레임 시퀀스로 예측 실행

**장점**:
- 클라이언트는 단순히 1프레임씩만 전송
- 서버가 시퀀스 관리 담당
- Stateless 클라이언트 (리로드해도 문제없음)

**주의사항**:
- 사용자 접속 종료 시 버퍼 정리
- 메모리 관리 (최대 동시 사용자 수 제한)

---

## 성능 최적화

**1. 배치 처리**
- 여러 사용자 요청을 모아서 배치로 처리
- GPU 활용률 극대화

**2. 모델 최적화**
- TorchScript: PyTorch 모델을 최적화된 형태로 변환
- ONNX Runtime: 더 빠른 추론 (옵션)
- 양자화 (Quantization): INT8로 변환 (속도 2배, 정확도 1-2% 감소)

**3. 비동기 처리**
- FastAPI async/await 활용
- GPU 추론 중에도 다른 요청 받기

---

# 🛠️ 개발 로드맵

## Week 1-2: 환경 설정 및 데이터 준비

- [ ] 개발 환경 구축 (PyTorch, CUDA 설정)
- [ ] 공개 데이터셋 다운로드 (AffectNet, FER2013)
- [ ] 데이터 전처리 파이프라인 구현
- [ ] 자체 데이터 수집 계획 수립 (참가자 모집)

## Week 3-4: 모델 개발 (Phase 1)

- [ ] MobileNetV3 + LSTM 모델 구현
- [ ] 공개 데이터셋으로 Pretrain
- [ ] Baseline 성능 평가 (목표: 75% 정확도)

## Week 5-6: 한국인 데이터 수집 및 Fine-tuning

- [ ] 자체 데이터 수집 (20-30명)
- [ ] 라벨링 작업
- [ ] Fine-tuning 수행
- [ ] 성능 평가 (목표: 85%+ 정확도)

## Week 7: API 서버 개발

- [ ] FastAPI 서버 구현
- [ ] WebSocket 스트리밍 구현
- [ ] 프레임 버퍼링 로직 구현
- [ ] 팀원과 API 통합 테스트

## Week 8: 최적화 및 배포

- [ ] TorchScript 변환
- [ ] 성능 벤치마크 (FPS, 레이턴시)
- [ ] Docker 컨테이너화
- [ ] 클라우드 배포 (AWS/GCP)

---

# 📝 다음 단계

## 즉시 시작할 작업

1. ✅ 프로젝트 구조 생성
2. ✅ Config 파일 작성
3. ⏳ 데이터 다운로드 스크립트 작성
4. ⏳ 모델 클래스 구현

## 의사결정 대기 중

없음 (모든 핵심 결정 완료)

## 팀원과 협의 필요

1. API 엔드포인트 스펙 최종 확인
2. 프레임 전송 방식 (REST vs WebSocket)
3. 배포 환경 (서버 스펙)

---

# 📚 참고 자료

## 논문

- MobileNetV3: "Searching for MobileNetV3" (2019)
- Facial Expression Recognition: "Challenges in Representation Learning" (FER2013)
- Temporal Modeling: "Beyond Short Snippets: Deep Networks for Video Classification" (2015)

## 데이터셋

- AffectNet: http://mohammadmahoor.com/affectnet/
- FER2013: https://www.kaggle.com/datasets/msambare/fer2013
- AI Hub 한국 데이터: https://www.aihub.or.kr/

## 도구

- PyTorch Documentation: https://pytorch.org/docs/
- FastAPI Documentation: https://fastapi.tiangolo.com/
- Albumentations (Augmentation): https://albumentations.ai/

---

작성자: AI 모델 개발자
검토자: -
승인일: -
