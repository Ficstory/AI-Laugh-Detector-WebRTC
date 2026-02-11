import * as ort from 'onnxruntime-web';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// ✅ [최우선] 모든 import 전에 배치!
if (typeof window !== 'undefined') {
  const win = window as any;
  
  // 1. Node.js 버전 정보 제거
  if (win.process?.versions?.node) {
    delete win.process.versions.node;
  }
  
  // 2. process.env를 완전히 제거 (ONNX Runtime이 체크하는 또 다른 포인트)
  if (win.process?.env) {
    win.process.env = {};
  }
  
  // 3. process.platform 제거
  if (win.process?.platform) {
    delete win.process.platform;
  }
  
  // 4. 아예 process 객체를 브라우저 스타일로 교체
  if (win.process) {
    const browserProcess = {
      env: {},
      browser: true,
    };
    win.process = browserProcess;
  }
}

const SEQUENCE_LENGTH = 5; // AI 모델 입력 형태: (1, 5, 3, 224, 224) - 5프레임
const EMA_ALPHA = 0.3;
const FACE_PADDING = 0.3;
const IMAGE_SIZE = 224;
const SMILE_THRESHOLD = 0.85;
const SMILE_CONFIRM_DURATION = 0.2; // seconds
const LOG_INTERVAL_MS = 5000;

export interface DetectionResult {
  id: number;
  box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  isSmiling: boolean;
  smileProb: number;
  emotion: string;
  status: string;
}

interface FaceTracker {
  id: number;
  emaSmile: number;
  smileStartTime: number | null;
  isConfirmedSmile: boolean;
  frameCount: number;
  frameBuffer: ort.Tensor[]; // ✅ 각 tracker마다 독립적인 버퍼
}

export class SmileDetector {
  private isRunning = false;
  private video: HTMLVideoElement | null = null;
  private faceDetector: FaceDetector | null = null;
  private session: ort.InferenceSession | null = null;
  private faceTrackers: Map<number, FaceTracker> = new Map();
  private nextTrackerId = 0;
  private onResultsCallback: (results: DetectionResult[]) => void = () => {};
  private processingCanvas: HTMLCanvasElement;
  private lastLogAt = 0;
  private lastTimestamp = 0;

  constructor() {
    this.processingCanvas = document.createElement('canvas');
    this.processingCanvas.width = IMAGE_SIZE;
    this.processingCanvas.height = IMAGE_SIZE;
  }

  async initialize(): Promise<void> {
    // console.log('[SmileDetector] Initializing...');
    try {

      // ✅ ONNX Runtime WASM 설정
      ort.env.wasm.proxy = false;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = '/ort-wasm/';
      ort.env.logLevel = 'warning';

      // Load ONNX model
      const modelPath = '/models/smile_detector.onnx';
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        // ✅ 멀티스레딩 명시적 비활성화
        extra: {
          session: {
            num_threads: "1"
          }
        }
      });
      // console.log('[SmileDetector] ONNX model loaded');

      // Load MediaPipe Face Detector
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
      );
      this.faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
      });
      // console.log('[SmileDetector] FaceDetector loaded');
    } catch (error) {
      console.error('[SmileDetector] Initialization failed:', error);
      throw error;
    }
  }

   private createNewTracker(detection: any): FaceTracker {
    const newId = this.nextTrackerId++;
    const newTracker: FaceTracker = {
      id: newId,
      emaSmile: 0.0,
      smileStartTime: null,
      isConfirmedSmile: false,
      frameCount: 0,
      frameBuffer: [], // ✅ 독립적인 버퍼
    };
    (newTracker as any).lastDetection = detection;
    this.faceTrackers.set(newId, newTracker);
    return newTracker;
  }

  start(videoElement: HTMLVideoElement, onResults: (results: DetectionResult[]) => void) {
    if (this.isRunning) {
      console.warn('[SmileDetector] Already running');
      return;
    }
    if (!this.session || !this.faceDetector) {
      throw new Error('[SmileDetector] Not initialized');
    }

    this.video = videoElement;
    this.onResultsCallback = onResults;
    this.isRunning = true;
    this.nextTrackerId = 0;
    this.faceTrackers.clear();
    this.lastTimestamp = 0;
    //console.log('[SmileDetector] Started');
    requestAnimationFrame(this.runDetectionLoop);
  }

  stop() {
    this.isRunning = false;
    
    // ✅ 모든 tracker의 버퍼 정리
    for (const tracker of this.faceTrackers.values()) {
      tracker.frameBuffer.forEach(tensor => tensor?.dispose());
      tracker.frameBuffer = [];
    }
    
    this.faceTrackers.clear();
    this.lastTimestamp = 0;
    //console.log('[SmileDetector] Stopped');
  }

  dispose() {
    this.stop();
    this.faceDetector?.close();
    this.faceDetector = null;
    this.session?.release();
    this.session = null;
    //console.log('[SmileDetector] Disposed');
  }

  private runDetectionLoop = async (timestamp: number) => {
    if (!this.isRunning || !this.video || !this.faceDetector) {
      return;
    }

    // 비디오 스트림이 아직 준비되지 않은 경우 (dimensions이 0이면) 스킵
    if (this.video.videoWidth === 0 || this.video.videoHeight === 0) {
      requestAnimationFrame(this.runDetectionLoop);
      return;
    }

    try {
      if (this.video.videoWidth <= 0 || this.video.videoHeight <= 0) {
        requestAnimationFrame(this.runDetectionLoop);
        return;
      }
      const safeTimestamp = Math.max(timestamp, this.lastTimestamp + 1);
      this.lastTimestamp = safeTimestamp;
      const detections = this.faceDetector.detectForVideo(this.video, safeTimestamp);
      const results: DetectionResult[] = [];

      // Process each detected face
      for (const detection of detections.detections) {
         let tracker = this.findMatchingTracker(detection);
        if (!tracker) {
          tracker = this.createNewTracker(detection);
        }else {
          // ✅✅✅ 핵심 수정: 기존 tracker를 찾았을 때도 lastDetection 업데이트!
          (tracker as any).lastDetection = detection;
        }

        const faceTensor = this.preprocessFace(detection);
        if (faceTensor) {
          // ✅ tracker의 독립적인 버퍼 사용
          if (tracker.frameBuffer.length >= SEQUENCE_LENGTH) {
            const oldTensor = tracker.frameBuffer.shift();
            oldTensor?.dispose();
          }
          tracker.frameBuffer.push(faceTensor);
        }

        // ✅ 각 tracker의 버퍼가 꽉 찼을 때만 추론
        if (tracker.frameBuffer.length === SEQUENCE_LENGTH) {
          await this.runInference(tracker);
        }

        // Create result
        const bb = detection.boundingBox!;
        results.push({
          id: tracker.id,
          box: {
            x1: bb.originX,
            y1: bb.originY,
            x2: bb.originX + bb.width,
            y2: bb.originY + bb.height,
          },
          isSmiling: tracker.isConfirmedSmile,
          smileProb: tracker.emaSmile,
          emotion: 'Detecting...',
          status: tracker.isConfirmedSmile ? 'SMILE' : 'NEUTRAL',
        });
      }

      this.cleanupOldTrackers(detections.detections);
      this.onResultsCallback(results);
    } catch (error) {
      console.error('[SmileDetector] Detection error:', error);
    }

    requestAnimationFrame(this.runDetectionLoop);
  };

  private findMatchingTracker(detection: any): FaceTracker | undefined {
    let bestMatch: FaceTracker | undefined = undefined;
    let bestDistance = 50;

    const newCenter = {
      x: detection.boundingBox.originX + detection.boundingBox.width / 2,
      y: detection.boundingBox.originY + detection.boundingBox.height / 2,
    };

    for (const tracker of this.faceTrackers.values()) {
      const oldCenter = {
        x: (tracker as any).lastDetection.boundingBox.originX + (tracker as any).lastDetection.boundingBox.width / 2,
        y: (tracker as any).lastDetection.boundingBox.originY + (tracker as any).lastDetection.boundingBox.height / 2,
      };
      const distance = Math.sqrt(
        Math.pow(newCenter.x - oldCenter.x, 2) + Math.pow(newCenter.y - oldCenter.y, 2)
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = tracker;
      }
    }
    return bestMatch;
  }

  private cleanupOldTrackers(currentDetections: any[]) {
    const idsToKeep = new Set<number>();
    for (const detection of currentDetections) {
      const tracker = this.findMatchingTracker(detection);
      if (tracker) idsToKeep.add(tracker.id);
    }

    for (const [id, tracker] of this.faceTrackers) {  // ✅ tracker 추가
      if (!idsToKeep.has(id)) {
        tracker.frameBuffer.forEach(tensor => tensor?.dispose());
        this.faceTrackers.delete(id);
      }
    }
  }

  private preprocessFace(detection: any): ort.Tensor | null {
    if (!this.video) return null;

    const { boundingBox } = detection;
    const h = this.video.videoHeight;
    const w = this.video.videoWidth;

    const padW = boundingBox.width * FACE_PADDING;
    const padH = boundingBox.height * FACE_PADDING;

    const x1 = Math.max(0, boundingBox.originX - padW);
    const y1 = Math.max(0, boundingBox.originY - padH);
    const x2 = Math.min(w, boundingBox.originX + boundingBox.width + padW);
    const y2 = Math.min(h, boundingBox.originY + boundingBox.height + padH);

    const faceWidth = x2 - x1;
    const faceHeight = y2 - y1;

    if (faceWidth <= 0 || faceHeight <= 0) return null;

    const ctx = this.processingCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(this.video, x1, y1, faceWidth, faceHeight, 0, 0, IMAGE_SIZE, IMAGE_SIZE);

    const imageData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
    const { data } = imageData;

    const float32Data = new Float32Array(3 * IMAGE_SIZE * IMAGE_SIZE);
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let i = 0; i < IMAGE_SIZE * IMAGE_SIZE; i++) {
      const r = data[i * 4 + 0] / 255;
      const g = data[i * 4 + 1] / 255;
      const b = data[i * 4 + 2] / 255;

      float32Data[i] = (r - mean[0]) / std[0];
      float32Data[i + IMAGE_SIZE * IMAGE_SIZE] = (g - mean[1]) / std[1];
      float32Data[i + 2 * IMAGE_SIZE * IMAGE_SIZE] = (b - mean[2]) / std[2];
    }

    return new ort.Tensor('float32', float32Data, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);
  }

  private async runInference(tracker: FaceTracker) {
    if (!this.session || tracker.frameBuffer.length < SEQUENCE_LENGTH) return;

    try {
      const sequenceTensor = this.stackTensors(tracker.frameBuffer); // ✅ tracker의 버퍼 사용
      const feeds = { input: sequenceTensor };
      const results = await this.session.run(feeds);

      const smileProb = (results.smile_prob?.data?.[0] as number) ?? 0.5;

      // Apply EMA
      tracker.emaSmile = EMA_ALPHA * smileProb + (1 - EMA_ALPHA) * tracker.emaSmile;

      // Check smile confirmation
      const currentTime = performance.now() / 1000;
      const isAboveThreshold = tracker.emaSmile > SMILE_THRESHOLD;

      // if (this.shouldLog()) {
      //   console.log('[SmileDetector] Inference:', {
      //     trackerId: tracker.id,
      //     smileProb: smileProb.toFixed(4),
      //     emaSmile: tracker.emaSmile.toFixed(4),
      //     isAboveThreshold,
      //     wasConfirmed: tracker.isConfirmedSmile,
      //   });
      // }

      if (isAboveThreshold) {
        if (tracker.smileStartTime === null) {
          tracker.smileStartTime = currentTime;
          // if (this.shouldLog()) {
          //   console.log('[SmileDetector] 웃음 시작 감지 (시간:', currentTime.toFixed(2), ')');
          // }
        }
        const elapsedTime = currentTime - (tracker.smileStartTime || 0);
        if (elapsedTime >= SMILE_CONFIRM_DURATION) {
          if (!tracker.isConfirmedSmile) {
            // if (this.shouldLog()) {
            //   console.log('[SmileDetector] ✅ 웃음 확정! (경과시간:', elapsedTime.toFixed(3), 's)');
            // }
            tracker.isConfirmedSmile = true;
          }
        }
      } else {
        if (tracker.isConfirmedSmile) {
          // if (this.shouldLog()) {
          //   console.log('[SmileDetector] 웃음 해제 (emaSmile:', tracker.emaSmile.toFixed(4), ')');
          // }
        }
        tracker.smileStartTime = null;
        tracker.isConfirmedSmile = false;
      }
    } catch (error) {
      console.error('[SmileDetector] Inference error:', error);
    }
  }

  private stackTensors(tensors: ort.Tensor[]): ort.Tensor {
    const tensorData = Float32Array.from(
      tensors.flatMap((t) => Array.from(t.data as Float32Array))
    );
    return new ort.Tensor('float32', tensorData, [1, SEQUENCE_LENGTH, 3, IMAGE_SIZE, IMAGE_SIZE]);
  }

  private shouldLog() {
    const now = performance.now();
    if (now - this.lastLogAt < LOG_INTERVAL_MS) return false;
    this.lastLogAt = now;
    return true;
  }
}
