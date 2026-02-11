"""
웹캠 실시간 웃음 감지 테스트
MediaPipe 얼굴 탐지 + 다중 인물 지원
"""
import cv2
import numpy as np
import onnxruntime as ort
import time
from collections import deque
from pathlib import Path
import mediapipe as mp


# 설정 (CPU 최적화)
SEQUENCE_LENGTH = 5       # LSTM에 넣을 프레임 수
EMA_ALPHA = 0.3           # 지수이동평균 계수 (낮을수록 부드러움)
INFERENCE_FPS = 6         # 추론 빈도 제한

# 웃음 판별 설정 (기본값, 트랙바로 조절 가능)
SMILE_THRESHOLD = 28      # 웃음 확률 임계값 (0-100) - 10 Epochs 최적값
SMILE_DURATION = 2        # 최소 웃음 지속시간 (0.1초 단위, 2 = 0.2초)

# 얼굴 탐지 설정
MAX_FACES = 4             # 최대 탐지 얼굴 수
FACE_PADDING = 0.3        # 얼굴 박스 패딩 (30%)


def load_model(model_path: str):
    """ONNX 모델 로드"""
    session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    print(f"ONNX 모델 로드 완료: {model_path}")
    return session


def preprocess_face(face_img, image_size=(224, 224)):
    """얼굴 이미지 전처리 -> (C, H, W) numpy 배열 반환"""
    resized = cv2.resize(face_img, image_size)
    normalized = resized.astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])
    normalized = (normalized - mean) / std
    arr = normalized.transpose(2, 0, 1).astype(np.float32)
    return arr  # (C, H, W)


def extract_face(frame, detection, padding=FACE_PADDING):
    """MediaPipe 탐지 결과에서 얼굴 크롭 (패딩 포함)"""
    h, w = frame.shape[:2]
    bbox = detection.location_data.relative_bounding_box

    # 상대 좌표 -> 절대 좌표
    x = int(bbox.xmin * w)
    y = int(bbox.ymin * h)
    bw = int(bbox.width * w)
    bh = int(bbox.height * h)

    # 패딩 적용
    pad_w = int(bw * padding)
    pad_h = int(bh * padding)

    x1 = max(0, x - pad_w)
    y1 = max(0, y - pad_h)
    x2 = min(w, x + bw + pad_w)
    y2 = min(h, y + bh + pad_h)

    face_img = frame[y1:y2, x1:x2]
    return face_img, (x1, y1, x2, y2)


class FaceTracker:
    """각 얼굴별 상태 추적"""
    def __init__(self):
        self.frame_buffer = deque(maxlen=SEQUENCE_LENGTH)
        self.ema_smile = 0.5
        self.ema_emotions = None
        self.smile_start_time = None
        self.is_confirmed_smile = False


def main():
    # ONNX 모델 로드 (파인튜닝 모델 사용)
    model_path = Path(__file__).parent / "models" / "smile_detector_finetuned.onnx"
    model = load_model(str(model_path))

    # MediaPipe 얼굴 탐지 초기화
    face_detection = mp.solutions.face_detection.FaceDetection(
        model_selection=0,  # 0: 근거리(2m), 1: 원거리(5m)
        min_detection_confidence=0.5
    )

    # 웹캠 열기
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("웹캠을 열 수 없습니다!")
        return

    print(f"\n웹캠 테스트 시작! (최대 {MAX_FACES}명, 시퀀스={SEQUENCE_LENGTH})")
    print("'q'를 누르면 종료됩니다.\n")

    # 윈도우 생성 및 트랙바 추가
    window_name = 'Smile Detection - Multi Face'
    cv2.namedWindow(window_name)
    cv2.createTrackbar('Threshold %', window_name, SMILE_THRESHOLD, 100, lambda _: None)
    cv2.createTrackbar('Duration x0.1s', window_name, SMILE_DURATION, 30, lambda _: None)

    # 얼굴별 추적기 (최대 MAX_FACES개)
    face_trackers = [FaceTracker() for _ in range(MAX_FACES)]

    # FPS 제한용
    last_inference_time = 0
    inference_interval = 1.0 / INFERENCE_FPS

    # 감정 이름 매핑
    emotion_names = {
        0: "Neutral", 1: "Anger", 2: "Disgust", 3: "Fear",
        4: "Happy", 5: "Sad", 6: "Surprise"
    }

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        current_time = time.time()

        # 트랙바에서 설정값 읽기
        threshold = cv2.getTrackbarPos('Threshold %', window_name) / 100.0
        duration = cv2.getTrackbarPos('Duration x0.1s', window_name) / 10.0

        # BGR -> RGB 변환 (MediaPipe 입력용)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_detection.process(rgb_frame)

        # 탐지된 얼굴 처리
        detections = results.detections if results.detections else []
        num_faces = min(len(detections), MAX_FACES)

        # FPS 제한 체크
        should_infer = (current_time - last_inference_time >= inference_interval)

        for i in range(num_faces):
            detection = detections[i]
            tracker = face_trackers[i]

            # 얼굴 크롭
            face_img, (x1, y1, x2, y2) = extract_face(rgb_frame, detection)

            if face_img.size == 0:
                continue

            # 전처리 및 버퍼에 추가
            preprocessed = preprocess_face(face_img)
            tracker.frame_buffer.append(preprocessed)

            # 추론
            if should_infer and len(tracker.frame_buffer) >= SEQUENCE_LENGTH:
                seq_array = np.stack(list(tracker.frame_buffer), axis=0)
                seq_array = np.expand_dims(seq_array, axis=0)  # (1, seq, C, H, W)

                input_name = model.get_inputs()[0].name
                outputs = model.run(None, {input_name: seq_array})
                smile_prob, emotion_logits = outputs[0], outputs[1]

                # softmax for emotions
                emotion_logits = emotion_logits[0]
                emotion_probs = np.exp(emotion_logits) / np.sum(np.exp(emotion_logits))

                # EMA 적용
                raw_smile = float(smile_prob[0])
                tracker.ema_smile = EMA_ALPHA * raw_smile + (1 - EMA_ALPHA) * tracker.ema_smile

                if tracker.ema_emotions is None:
                    tracker.ema_emotions = emotion_probs
                else:
                    tracker.ema_emotions = (EMA_ALPHA * emotion_probs
                                            + (1 - EMA_ALPHA) * tracker.ema_emotions)

            # 웃음 지속시간 체크
            above_threshold = tracker.ema_smile > threshold

            if above_threshold:
                if tracker.smile_start_time is None:
                    tracker.smile_start_time = current_time
                elif current_time - tracker.smile_start_time >= duration:
                    tracker.is_confirmed_smile = True
            else:
                tracker.smile_start_time = None
                tracker.is_confirmed_smile = False

            # 얼굴 박스 색상
            color = (0, 255, 0) if tracker.is_confirmed_smile else (0, 0, 255)

            # 얼굴 박스 그리기
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # 상태 텍스트
            if tracker.is_confirmed_smile:
                status = "Smiling!"
            elif above_threshold and tracker.smile_start_time:
                elapsed = current_time - tracker.smile_start_time
                status = f"{elapsed:.1f}/{duration:.1f}s"
            else:
                status = ""

            # 얼굴 위에 정보 표시
            smile_text = f"#{i+1} {tracker.ema_smile:.0%} {status}"
            cv2.putText(frame, smile_text, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

            # 감정 표시 (박스 아래)
            if tracker.ema_emotions is not None:
                emotion_idx = int(np.argmax(tracker.ema_emotions))
                emotion_name = emotion_names.get(emotion_idx, f"Class {emotion_idx}")
                cv2.putText(frame, emotion_name, (x1, y2 + 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        if should_infer:
            last_inference_time = current_time

        # 전체 정보 표시
        info_text = f"Faces: {num_faces} | Thresh: {threshold:.0%} | Dur: {duration:.1f}s"
        cv2.putText(frame, info_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        cv2.imshow(window_name, frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    face_detection.close()
    cap.release()
    cv2.destroyAllWindows()
    print("\n테스트 종료!")


if __name__ == "__main__":
    main()
