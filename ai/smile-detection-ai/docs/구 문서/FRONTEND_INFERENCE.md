# 프론트엔드 직접 추론 가이드
해야 할 일
1. ONNX 모델 파일 복사

models/smile_detector.onnx (7.36MB)
→ 프론트엔드 프로젝트의 public/models/ 폴더에 복사
2. 프론트엔드에서 패키지 설치

npm install onnxruntime-web
3. 프론트엔드 코드에서 사용

import * as ort from 'onnxruntime-web';

// 모델 로드 (앱 시작 시 1회)
const session = await ort.InferenceSession.create('/models/smile_detector.onnx');

// 추론 (웹캠 프레임 캡처 후)
const tensor = new ort.Tensor('float32', tensorData, [1, 3, 3, 224, 224]);
const results = await session.run({ input: tensor });
const smileProb = results.smile_prob.data[0]; // 0~1 사이 값
현재 상황 정리
방식	장점	단점
서버 API (현재)	GPU 사용 가능, 12ms	HTTP 오버헤드
ONNX 직접 추론	네트워크 없음, 프라이버시	브라우저 CPU/WebGL 사용
프론트엔드 프로젝트 경로가 어디인지 알려주시면 직접 연동 코드를 작성해드릴 수 있습니다.


## ONNX Runtime Web 설치

```bash
npm install onnxruntime-web
```

## 모델 파일
- 경로: `models/smile_detector.onnx` (7.36MB)
- 입력: `(1, 3, 3, 224, 224)` - batch=1, seq=3프레임, 채널=3, 크기=224x224
- 출력: `smile_prob` (웃음 확률), `emotion_logits` (7개 감정 로짓)

## JavaScript 구현

```javascript
import * as ort from 'onnxruntime-web';

class SmileDetector {
  constructor() {
    this.session = null;
    this.frameBuffer = [];
    this.SEQUENCE_LENGTH = 3;
    this.IMAGE_SIZE = 224;
    this.isProcessing = false;
  }

  async loadModel(modelPath) {
    // WASM 백엔드 사용 (WebGL도 가능)
    ort.env.wasm.wasmPaths = '/onnx/';
    this.session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['wasm'] // 또는 ['webgl']
    });
    console.log('Model loaded');
  }

  // 비디오 프레임을 캡처하고 전처리
  captureFrame(video, canvas, ctx) {
    ctx.drawImage(video, 0, 0, this.IMAGE_SIZE, this.IMAGE_SIZE);
    const imageData = ctx.getImageData(0, 0, this.IMAGE_SIZE, this.IMAGE_SIZE);

    // RGB 분리, 0~1 정규화, Channel-first 변환
    const frame = new Float32Array(3 * this.IMAGE_SIZE * this.IMAGE_SIZE);
    let offset = 0;

    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < this.IMAGE_SIZE * this.IMAGE_SIZE; i++) {
        frame[offset++] = imageData.data[i * 4 + c] / 255.0;
      }
    }

    return frame;
  }

  // 3프레임을 텐서로 변환
  createTensor(frames) {
    const tensorData = new Float32Array(1 * 3 * 3 * 224 * 224);
    let offset = 0;

    for (const frame of frames) {
      tensorData.set(frame, offset);
      offset += frame.length;
    }

    return new ort.Tensor('float32', tensorData, [1, 3, 3, 224, 224]);
  }

  // 추론 실행
  async infer(frames) {
    if (!this.session || this.isProcessing) return null;

    this.isProcessing = true;
    const startTime = performance.now();

    try {
      const inputTensor = this.createTensor(frames);
      const results = await this.session.run({ input: inputTensor });

      const smileProb = results.smile_prob.data[0];
      const emotionLogits = Array.from(results.emotion_logits.data);

      // Softmax for emotions
      const emotionProbs = this.softmax(emotionLogits);
      const emotionIdx = emotionProbs.indexOf(Math.max(...emotionProbs));
      const emotionNames = ['Neutral', 'Anger', 'Disgust', 'Fear', 'Happy', 'Sad', 'Surprise'];

      const inferenceTime = performance.now() - startTime;

      return {
        smileProb,
        isSmiling: smileProb > 0.18,
        emotion: emotionNames[emotionIdx],
        emotionProbs,
        inferenceTime
      };
    } finally {
      this.isProcessing = false;
    }
  }

  softmax(arr) {
    const max = Math.max(...arr);
    const exps = arr.map(x => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b);
    return exps.map(x => x / sum);
  }

  // 버퍼에 프레임 추가
  addFrame(frame) {
    this.frameBuffer.push(frame);
    if (this.frameBuffer.length > this.SEQUENCE_LENGTH) {
      this.frameBuffer.shift();
    }
  }

  canInfer() {
    return this.frameBuffer.length === this.SEQUENCE_LENGTH && !this.isProcessing;
  }

  getFrames() {
    return [...this.frameBuffer];
  }
}

// 사용 예시
async function main() {
  const detector = new SmileDetector();
  await detector.loadModel('/models/smile_detector.onnx');

  const video = document.getElementById('webcam');
  const canvas = document.createElement('canvas');
  canvas.width = 224;
  canvas.height = 224;
  const ctx = canvas.getContext('2d');

  // 얼굴 탐지 (MediaPipe 또는 face-api.js 사용)
  // ... 얼굴 크롭 로직 ...

  // 30fps로 프레임 캡처, 2프레임마다 추론
  let frameCount = 0;

  function loop() {
    const frame = detector.captureFrame(video, canvas, ctx);
    detector.addFrame(frame);
    frameCount++;

    // Stride=2: 2프레임마다 추론
    if (frameCount % 2 === 0 && detector.canInfer()) {
      detector.infer(detector.getFrames()).then(result => {
        if (result) {
          console.log(`Smile: ${(result.smileProb * 100).toFixed(1)}%`);
          console.log(`Emotion: ${result.emotion}`);
          console.log(`Time: ${result.inferenceTime.toFixed(1)}ms`);

          // UI 업데이트
          updateSmileGauge(result.smileProb);
        }
      });
    }

    requestAnimationFrame(loop);
  }

  loop();
}
```

## 성능 비교

| 방식 | 레이턴시 | 장점 |
|------|----------|------|
| 서버 API | ~100ms+ | 서버 GPU 사용 가능 |
| ONNX Web (WASM) | ~60-80ms | 네트워크 없음, 프라이버시 |
| ONNX Web (WebGL) | ~30-50ms | GPU 가속, 가장 빠름 |

## 주의사항

1. **얼굴 탐지**: 위 코드는 전체 프레임을 사용. 실제로는 MediaPipe 또는 face-api.js로 얼굴 크롭 필요
2. **CORS**: ONNX 파일 서빙 시 CORS 헤더 필요
3. **WASM 파일**: `onnxruntime-web`의 WASM 파일들을 정적 파일로 서빙 필요
