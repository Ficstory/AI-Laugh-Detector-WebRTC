"""
모델 로딩 및 추론 서비스
"""
import torch
import yaml
import cv2
import numpy as np
import base64
import time
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import mediapipe as mp

from src.models.smile_detector_dual import DualHeadSmileDetector


class ModelService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.model = None
        self.device = None
        self.config = None
        self.face_detection = None
        self.settings = {
            "smile_threshold": 0.2820,  # 10 Epochs 모델 최적 threshold
            "max_faces": 4
        }
        self._initialized = True

    def load_model(self) -> bool:
        """모델 로드"""
        try:
            base_path = Path(__file__).parent.parent.parent

            # 설정 로드
            config_path = base_path / "config.yaml"
            with open(config_path, 'r', encoding='utf-8') as f:
                self.config = yaml.safe_load(f)

            # 디바이스 설정
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

            # 모델 로드
            checkpoint_path = base_path / "checkpoints" / "best_model.pth"
            self.model = DualHeadSmileDetector(self.config['model'])
            checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.model.to(self.device)
            self.model.eval()

            # MediaPipe 얼굴 탐지 초기화
            self.face_detection = mp.solutions.face_detection.FaceDetection(
                model_selection=0,
                min_detection_confidence=0.5
            )

            return True
        except Exception as e:
            print(f"모델 로드 실패: {e}")
            return False

    def is_loaded(self) -> bool:
        return self.model is not None

    def get_device(self) -> str:
        if self.device is None:
            return "unknown"
        return str(self.device)

    def preprocess_face(self, face_img: np.ndarray, image_size: Tuple[int, int] = (224, 224)) -> torch.Tensor:
        """얼굴 이미지 전처리"""
        resized = cv2.resize(face_img, image_size)
        normalized = resized.astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        normalized = (normalized - mean) / std
        tensor = torch.from_numpy(normalized.transpose(2, 0, 1)).float()
        return tensor

    def extract_faces(self, frame: np.ndarray, padding: float = 0.3) -> List[Dict]:
        """이미지에서 얼굴 추출"""
        if self.face_detection is None:
            return []

        h, w = frame.shape[:2]
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_detection.process(rgb_frame)

        faces = []
        if results.detections:
            for i, detection in enumerate(results.detections[:self.settings["max_faces"]]):
                bbox = detection.location_data.relative_bounding_box

                x = int(bbox.xmin * w)
                y = int(bbox.ymin * h)
                bw = int(bbox.width * w)
                bh = int(bbox.height * h)

                pad_w = int(bw * padding)
                pad_h = int(bh * padding)

                x1 = max(0, x - pad_w)
                y1 = max(0, y - pad_h)
                x2 = min(w, x + bw + pad_w)
                y2 = min(h, y + bh + pad_h)

                face_img = frame[y1:y2, x1:x2]
                if face_img.size > 0:
                    faces.append({
                        "face_id": i,
                        "image": face_img,
                        "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
                    })

        return faces

    def analyze_face(self, face_img: np.ndarray, threshold: Optional[float] = None) -> Dict:
        """단일 얼굴 분석"""
        if threshold is None:
            threshold = self.settings["smile_threshold"]

        # 전처리
        tensor = self.preprocess_face(face_img)
        # (C, H, W) -> (1, 1, C, H, W) for LSTM
        tensor = tensor.unsqueeze(0).unsqueeze(0).to(self.device)

        # 추론
        with torch.no_grad():
            smile_logits, emotion_logits = self.model(tensor)
            smile_prob = torch.sigmoid(smile_logits).item()
            emotion_probs = torch.softmax(emotion_logits, dim=1).squeeze().cpu().numpy()

        # 감정 레이블
        emotion_labels = ["Neutral", "Anger", "Disgust", "Fear", "Happy", "Sad", "Surprise"]
        emotion_idx = int(np.argmax(emotion_probs))

        return {
            "smile": {
                "probability": round(smile_prob, 4),
                "is_smiling": smile_prob >= threshold
            },
            "emotion": {
                "label": emotion_labels[emotion_idx],
                "confidence": round(float(emotion_probs[emotion_idx]), 4),
                "all_scores": {
                    label: round(float(prob), 4)
                    for label, prob in zip(emotion_labels, emotion_probs)
                }
            }
        }

    def analyze_image(
        self,
        image: np.ndarray,
        threshold: Optional[float] = None,
        return_faces: bool = False
    ) -> Dict:
        """이미지 분석 (얼굴 탐지 + 웃음/감정 분석)"""
        start_time = time.time()

        if threshold is None:
            threshold = self.settings["smile_threshold"]

        # 얼굴 추출
        faces = self.extract_faces(image)

        if not faces:
            return {
                "faces": [],
                "total_faces": 0,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

        # 각 얼굴 분석
        results = []
        for face_data in faces:
            analysis = self.analyze_face(face_data["image"], threshold)

            result = {
                "face_id": face_data["face_id"],
                "bbox": face_data["bbox"],
                "smile": analysis["smile"],
                "emotion": analysis["emotion"]
            }

            if return_faces:
                _, buffer = cv2.imencode('.jpg', face_data["image"])
                result["face_image"] = base64.b64encode(buffer).decode('utf-8')

            results.append(result)

        return {
            "faces": results,
            "total_faces": len(results),
            "processing_time_ms": int((time.time() - start_time) * 1000)
        }

    def decode_base64_image(self, base64_string: str) -> np.ndarray:
        """Base64 문자열을 이미지로 디코딩"""
        img_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return image

    def analyze_sequence(
        self,
        frames: List[np.ndarray],
        threshold: Optional[float] = None,
        return_faces: bool = False
    ) -> Dict:
        """
        프레임 시퀀스 분석 (Y자형 듀얼헤드)
        - 10프레임을 한 번에 받아서 (1, seq_len, C, H, W) 형태로 모델에 입력
        - Smile Head: LSTM으로 시간적 패턴 분석
        - Emotion Head: 마지막 프레임 기준 감정 분류
        """
        start_time = time.time()

        if threshold is None:
            threshold = self.settings["smile_threshold"]

        if not frames:
            return {
                "smile": {"probability": 0.0, "is_smiling": False},
                "emotion": None,
                "sequence_length": 0,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

        # 첫 프레임에서 얼굴 탐지 (이후 프레임은 같은 위치 사용)
        first_frame = frames[0]
        faces = self.extract_faces(first_frame)

        if not faces:
            return {
                "smile": {"probability": 0.0, "is_smiling": False},
                "emotion": None,
                "faces_detected": 0,
                "sequence_length": len(frames),
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

        # 첫 번째 얼굴 기준으로 처리 (단일 플레이어)
        face_data = faces[0]
        bbox = face_data["bbox"]

        # 각 프레임에서 같은 위치의 얼굴 크롭 후 텐서로 변환
        frame_tensors = []
        for frame in frames:
            face_img = frame[bbox["y1"]:bbox["y2"], bbox["x1"]:bbox["x2"]]
            if face_img.size > 0:
                tensor = self.preprocess_face(face_img)
                frame_tensors.append(tensor)

        if not frame_tensors:
            return {
                "smile": {"probability": 0.0, "is_smiling": False},
                "emotion": None,
                "faces_detected": 0,
                "sequence_length": len(frames),
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

        # (seq_len, C, H, W) -> (1, seq_len, C, H, W)
        sequence_tensor = torch.stack(frame_tensors).unsqueeze(0).to(self.device)

        # 모델 추론
        with torch.no_grad():
            smile_logits, emotion_logits = self.model(sequence_tensor)
            smile_prob = torch.sigmoid(smile_logits).item()
            emotion_probs = torch.softmax(emotion_logits, dim=1).squeeze().cpu().numpy()

        # 감정 레이블
        emotion_labels = ["Neutral", "Anger", "Disgust", "Fear", "Happy", "Sad", "Surprise"]
        emotion_idx = int(np.argmax(emotion_probs))

        result = {
            "smile": {
                "probability": round(smile_prob, 4),
                "is_smiling": smile_prob >= threshold
            },
            "emotion": {
                "label": emotion_labels[emotion_idx],
                "confidence": round(float(emotion_probs[emotion_idx]), 4),
                "all_scores": {
                    label: round(float(prob), 4)
                    for label, prob in zip(emotion_labels, emotion_probs)
                }
            },
            "bbox": bbox,
            "sequence_length": len(frame_tensors),
            "processing_time_ms": int((time.time() - start_time) * 1000)
        }

        if return_faces:
            _, buffer = cv2.imencode('.jpg', face_data["image"])
            result["face_image"] = base64.b64encode(buffer).decode('utf-8')

        return result

    def analyze_binary_batch(
        self,
        tensor_data: bytes,
        shape: Tuple[int, ...],
        threshold: Optional[float] = None
    ) -> Dict:
        """
        Binary 텐서 배치 분석
        - 프론트에서 전처리 완료된 Float32 텐서를 직접 받음
        - shape: (1, 10, 3, 224, 224)
        - 정규화: 0~1 (프론트에서 완료)
        """
        start_time = time.time()
        received_bytes = len(tensor_data)

        if threshold is None:
            threshold = self.settings["smile_threshold"]

        # bytes -> numpy -> torch
        tensor = np.frombuffer(tensor_data, dtype=np.float32)
        tensor = tensor.reshape(shape)  # (1, 10, 3, 224, 224)
        tensor = torch.from_numpy(tensor).to(self.device)

        # 모델 추론
        with torch.no_grad():
            smile_logits, emotion_logits = self.model(tensor)
            smile_prob = torch.sigmoid(smile_logits).item()

        is_smiling = smile_prob >= threshold

        return {
            "success": True,
            "isSmiling": is_smiling,
            "confidence": round(smile_prob, 4),
            "metadata": {
                "processingTime": round((time.time() - start_time) * 1000, 2),
                "modelVersion": self.config['model'].get('version', 'unknown'),
                "receivedFrames": shape[1],
                "receivedBytes": received_bytes
            }
        }

    def get_settings(self) -> Dict:
        return self.settings.copy()

    def update_settings(self, updates: Dict) -> Dict:
        for key, value in updates.items():
            if key in self.settings and value is not None:
                self.settings[key] = value
        return self.settings.copy()


# 싱글톤 인스턴스
model_service = ModelService()
