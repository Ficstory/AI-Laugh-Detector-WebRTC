# Smile Detection API 명세서

## 개요

| 항목 | 내용 |
|------|------|
| 서비스명 | Smile Detection API |
| 버전 | v1.1.0 |
| Base URL | `http://localhost:8000/api/v1` |
| 프로토콜 | HTTP |

---

## 아키텍처

```
AI 서버 (FastAPI) ←──HTTP──→ 프론트 ←──WS──→ 백엔드
```

- AI 서버: 웃음 감지만 담당
- 프론트: 프레임 전송, 결과 수신, 백엔드로 게이지 전송
- 백엔드: 게임 로직, 멀티플레이어 동기화

---

## 인증

현재 버전에서는 인증 없이 사용 가능.

---

## 공통 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-01-16T12:00:00Z"
}
```

### 에러 응답
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지"
  },
  "timestamp": "2025-01-16T12:00:00Z"
}
```

### 에러 코드
| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| `INVALID_IMAGE` | 400 | 유효하지 않은 이미지 형식 |
| `NO_FACE_DETECTED` | 400 | 얼굴이 탐지되지 않음 |
| `MODEL_ERROR` | 500 | 모델 추론 실패 |
| `SERVER_ERROR` | 500 | 서버 내부 오류 |

---

## REST API 엔드포인트

### 1. 헬스 체크

서버 상태 확인

```
GET /health
```

**응답**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "model_loaded": true,
    "device": "cuda",
    "version": "1.1.0"
  }
}
```

---

### 2. 단일 이미지 분석

이미지에서 웃음/감정 분석

```
POST /analyze/image
```

**Request**
- Content-Type: `multipart/form-data`

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `image` | file | O | 분석할 이미지 (JPEG, PNG) |
| `threshold` | float | X | 웃음 임계값 (기본: 0.18) |
| `return_faces` | bool | X | 크롭된 얼굴 이미지 반환 여부 (기본: false) |

**응답**
```json
{
  "success": true,
  "data": {
    "faces": [
      {
        "face_id": 0,
        "bbox": {
          "x1": 100,
          "y1": 50,
          "x2": 200,
          "y2": 180
        },
        "smile": {
          "probability": 0.85,
          "is_smiling": true
        },
        "emotion": {
          "label": "Happy",
          "confidence": 0.72,
          "all_scores": {
            "Neutral": 0.10,
            "Anger": 0.02,
            "Disgust": 0.01,
            "Fear": 0.03,
            "Happy": 0.72,
            "Sad": 0.05,
            "Surprise": 0.07
          }
        },
        "face_image": "base64_encoded_string..."
      }
    ],
    "total_faces": 1,
    "processing_time_ms": 45
  }
}
```

---

### 3. Base64 이미지 분석

Base64 인코딩된 이미지 분석 (프론트에서 canvas로 추출한 이미지용)

```
POST /analyze/base64
```

**Request**
- Content-Type: `application/json`

```json
{
  "image": "base64_encoded_image_string",
  "threshold": 0.18,
  "return_faces": false
}
```

**응답**: 단일 이미지 분석과 동일

---

### 4. 프레임 시퀀스 배치 분석 (메인 API)

10프레임 시퀀스를 받아 Y자형 듀얼헤드 모델로 분석

```
POST /analyze/batch
```

**Request**
- Content-Type: `application/json`

```json
{
  "frames": [
    "base64_frame_1",
    "base64_frame_2",
    "...",
    "base64_frame_10"
  ],
  "threshold": 0.18,
  "return_faces": false
}
```

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `frames` | string[] | O | Base64 인코딩된 프레임 리스트 (10프레임 권장) |
| `threshold` | float | X | 웃음 임계값 (기본: 0.18) |
| `return_faces` | bool | X | 크롭된 얼굴 이미지 반환 여부 (기본: false) |

**응답**
```json
{
  "success": true,
  "data": {
    "smile": {
      "probability": 0.85,
      "is_smiling": true
    },
    "emotion": {
      "label": "Happy",
      "confidence": 0.72,
      "all_scores": {
        "Neutral": 0.10,
        "Anger": 0.02,
        "Disgust": 0.01,
        "Fear": 0.03,
        "Happy": 0.72,
        "Sad": 0.05,
        "Surprise": 0.07
      }
    },
    "bbox": {
      "x1": 100,
      "y1": 50,
      "x2": 200,
      "y2": 180
    },
    "sequence_length": 10,
    "processing_time_ms": 85
  }
}
```

**모델 동작 방식 (Y자형 듀얼헤드)**
- 10프레임을 `(1, 10, C, H, W)` 형태로 모델에 입력
- CNN: 각 프레임에서 특징 추출
- LSTM: 시간적 패턴 학습 → **웃음 확률** 출력
- Emotion Head: 마지막 프레임 기준 → **감정 분류** 출력

---

### 5. Binary 배치 분석 (프로덕션용)

프론트에서 전처리 완료된 Float32 텐서를 직접 수신하여 분석

```
POST /analyze/binary-batch
```

**Request**
- Content-Type: `application/octet-stream`
- Body: `Float32Array.buffer` (정규화 완료된 텐서)

**Headers**

| 헤더 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `X-Tensor-Shape` | string | O | 텐서 shape (예: `1,10,3,224,224`) |
| `X-Tensor-Dtype` | string | X | 데이터 타입 (기본: `float32`) |
| `X-Timestamp` | string | X | 클라이언트 타임스탬프 |
| `threshold` | float | X | 웃음 판정 임계값 (기본: 0.18) |

**텐서 스펙**

| 항목 | 값 |
|------|-----|
| Shape | `(1, 10, 3, 224, 224)` |
| Dtype | Float32 |
| 정규화 | 0~1 (프론트에서 완료) |
| 채널 순서 | RGB, Channel-first |
| 바이트 크기 | 6,021,120 bytes (약 5.74 MB) |

**성공 응답**
```json
{
  "success": true,
  "isSmiling": true,
  "confidence": 0.94,
  "frameResults": [
    {"frame": 0, "score": 0.94},
    {"frame": 1, "score": 0.94},
    ...
  ],
  "avgScore": 0.94,
  "metadata": {
    "processingTime": 145,
    "modelVersion": "v1.0.0",
    "receivedFrames": 10,
    "receivedBytes": 6021120
  }
}
```

**에러 응답**
```json
{
  "success": false,
  "error": "InvalidTensorShape",
  "message": "Expected shape (1,10,3,224,224), got (1,5,3,224,224)",
  "receivedShape": [1, 5, 3, 224, 224]
}
```

**프론트엔드 연동 예시**
```javascript
// 슬라이딩 윈도우 설정
const WINDOW_SIZE = 10;
const STRIDE = 8;
let frameBuffer = [];

// 프레임 캡처 (ImageCapture API)
async function captureFrame(imageCapture, canvas, ctx) {
  const imageBitmap = await imageCapture.grabFrame();
  ctx.drawImage(imageBitmap, 0, 0, 224, 224);
  const imageData = ctx.getImageData(0, 0, 224, 224);
  return imageData;
}

// 텐서 생성 (10프레임)
function createBatchTensor(frames) {
  const tensor = new Float32Array(1 * 10 * 3 * 224 * 224);
  let offset = 0;

  for (const frame of frames) {
    const data = frame.data;
    // RGB 채널 분리, 0~1 정규화
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 224 * 224; i++) {
        tensor[offset++] = data[i * 4 + c] / 255.0;
      }
    }
  }
  return tensor;
}

// Binary 전송
async function analyzeBinaryBatch(tensor) {
  const response = await fetch('http://localhost:8000/api/v1/analyze/binary-batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Tensor-Shape': '1,10,3,224,224',
      'X-Tensor-Dtype': 'float32'
    },
    body: tensor.buffer
  });
  return response.json();
}

// 연속 분석 루프 (Window=10, Stride=8)
async function analyzeLoop() {
  while (isAnalyzing) {
    // 8프레임 새로 캡처
    for (let i = 0; i < STRIDE; i++) {
      const frame = await captureFrame(imageCapture, canvas, ctx);
      frameBuffer.push(frame);
    }

    // 오래된 프레임 제거 (윈도우 유지)
    while (frameBuffer.length > WINDOW_SIZE) {
      frameBuffer.shift();
    }

    if (frameBuffer.length === WINDOW_SIZE) {
      const tensor = createBatchTensor(frameBuffer);
      const result = await analyzeBinaryBatch(tensor);

      if (result.success) {
        updateSmileGauge(result.confidence);
      }
    }
  }
}
```

---

### 6. 설정 조회/변경

#### 현재 설정 조회
```
GET /settings
```

**응답**
```json
{
  "success": true,
  "data": {
    "smile_threshold": 0.18,
    "max_faces": 4
  }
}
```

#### 설정 변경
```
PATCH /settings
```

**Request**
```json
{
  "smile_threshold": 0.25
}
```

---

## 게임 연동 시나리오 (HTTP 방식)

### 프론트엔드 연동 예시 (배치 API 사용)

```javascript
// 프레임 버퍼 (10프레임 수집)
const frameBuffer = [];
const BATCH_SIZE = 10;

// 프레임 수집 (10fps)
function captureFrame(video, canvas) {
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  frameBuffer.push(base64);
}

// 10프레임 모이면 배치 분석
async function analyzeBatch() {
  if (frameBuffer.length < BATCH_SIZE) return;

  const frames = frameBuffer.splice(0, BATCH_SIZE);

  const response = await fetch('http://localhost:8000/api/v1/analyze/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frames: frames,
      threshold: 0.18
    })
  });

  const result = await response.json();

  if (result.success) {
    updateSmileGauge(result.data.smile.probability);

    if (result.data.smile.is_smiling) {
      // 백엔드로 게이지 정보 전송 (WS)
      sendToBackend(result.data.smile.probability);
    }
  }
}

// 10fps로 프레임 캡처
setInterval(() => captureFrame(video, canvas), 100);

// 1초마다 배치 분석 (10프레임씩)
setInterval(() => analyzeBatch(), 1000);
```

---

## 성능 사양

| 항목 | 값 |
|------|-----|
| 권장 프레임 크기 | 640x480 |
| 최대 프레임 크기 | 1920x1080 |
| 권장 전송 FPS | 10 fps |
| 평균 응답 시간 | 30-50ms (GPU) |
| 최대 동시 얼굴 | 4명 |

---

## 버전 히스토리

| 버전 | 날짜 | 변경사항 |
|------|------|----------|
| 1.0.0 | 2025-01-16 | 초기 버전 |
| 1.1.0 | 2025-01-20 | WebSocket 제거, HTTP 전용으로 변경 |
| 1.2.0 | 2025-01-20 | 배치 API 추가 (Y자형 듀얼헤드, LSTM 시퀀스 입력) |
| 1.3.0 | 2025-01-21 | Binary 배치 API 추가 (프로덕션용) |
