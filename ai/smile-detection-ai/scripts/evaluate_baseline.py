"""
Baseline 모델 성능 평가 스크립트
- ONNX 모델로 수집된 데이터 평가
- 6개 지표: Accuracy, Precision, Recall, F1, ROC/AUC, Optimal Threshold
- Y자형 듀얼 헤드 모델: 회귀 헤드(웃음 수치) 사용
"""

import cv2
import numpy as np
import csv
import json
from pathlib import Path
from datetime import datetime
import onnxruntime as ort
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_curve, auc, confusion_matrix
)
import matplotlib.pyplot as plt


class BaselineEvaluator:
    def __init__(self, model_path: str = None, data_dir: str = None):
        # 기본 경로 설정
        script_dir = Path(__file__).resolve().parent

        if model_path is None:
            model_path = script_dir.parent / "models" / "smile_detector.onnx"
        if data_dir is None:
            data_dir = script_dir.parent / "data" / "eval"

        self.model_path = Path(model_path)
        self.data_dir = Path(data_dir)
        self.images_dir = self.data_dir / "images"
        self.csv_path = self.data_dir / "labels.csv"

        # ONNX 모델 로드
        print(f"Loading model: {self.model_path}")
        self.session = ort.InferenceSession(str(self.model_path))
        self.input_name = self.session.get_inputs()[0].name

        # 출력 정보 확인
        self.outputs = [o.name for o in self.session.get_outputs()]
        print(f"Model outputs: {self.outputs}")

        # 전처리 설정
        self.img_size = (224, 224)
        self.mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        self.std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    def preprocess_image(self, img_path: Path) -> np.ndarray:
        """이미지 전처리 (224x224, 정규화, CHW)"""
        img = cv2.imread(str(img_path))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, self.img_size)

        # 정규화: 0~255 -> 0~1 -> ImageNet 표준화
        img = img.astype(np.float32) / 255.0
        img = (img - self.mean) / self.std

        # HWC -> CHW
        img = img.transpose(2, 0, 1)

        return img

    def load_sequence(self, row: dict) -> np.ndarray:
        """5프레임 시퀀스 로드 및 전처리"""
        frames = []
        for i in range(5):
            img_path = self.images_dir / row[f'frame_{i}']
            if not img_path.exists():
                raise FileNotFoundError(f"Image not found: {img_path}")
            frame = self.preprocess_image(img_path)
            frames.append(frame)

        # (5, 3, 224, 224) -> (1, 5, 3, 224, 224)
        sequence = np.stack(frames, axis=0)
        sequence = np.expand_dims(sequence, axis=0).astype(np.float32)

        return sequence

    def predict(self, sequence: np.ndarray) -> float:
        """모델 추론 - smile_prob 출력 (웃음 확률 0~1)"""
        outputs = self.session.run(None, {self.input_name: sequence})

        # outputs[0] = smile_prob: (batch, 1)
        # outputs[1] = emotion_logits: (batch, 7)
        smile_prob = outputs[0]  # (1, 1) 형태

        # 스칼라로 변환
        smile_score = float(smile_prob.flatten()[0])

        # 0~1 범위로 클리핑
        smile_score = max(0.0, min(1.0, smile_score))

        return smile_score

    def evaluate(self, threshold: float = 0.5) -> dict:
        """전체 데이터셋 평가"""
        print(f"\nEvaluating with threshold: {threshold}")
        print(f"Data directory: {self.data_dir}")

        # CSV 로드
        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        print(f"Total sequences: {len(rows)}")

        y_true = []  # 실제 라벨 (0: non_smile, 1: smile)
        y_scores = []  # 모델 출력 (웃음 수치)
        y_pred = []  # 예측 라벨 (threshold 적용)

        for i, row in enumerate(rows):
            # 실제 라벨
            label = 1 if row['label'] == 'smile' else 0
            y_true.append(label)

            # 모델 추론
            try:
                sequence = self.load_sequence(row)
                smile_score = self.predict(sequence)
                y_scores.append(smile_score)
                y_pred.append(1 if smile_score >= threshold else 0)

                if (i + 1) % 10 == 0:
                    print(f"  Processed {i + 1}/{len(rows)}")
            except Exception as e:
                print(f"  Error processing {row['sequence_id']}: {e}")
                y_scores.append(0.0)
                y_pred.append(0)

        # 지표 계산
        y_true = np.array(y_true)
        y_scores = np.array(y_scores)
        y_pred = np.array(y_pred)

        accuracy = accuracy_score(y_true, y_pred)
        precision = precision_score(y_true, y_pred, zero_division=0)
        recall = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)

        # ROC/AUC
        fpr, tpr, thresholds = roc_curve(y_true, y_scores)
        roc_auc = auc(fpr, tpr)

        # Optimal Threshold (Youden's J)
        j_scores = tpr - fpr
        optimal_idx = np.argmax(j_scores)
        optimal_threshold = thresholds[optimal_idx]

        # Confusion Matrix
        cm = confusion_matrix(y_true, y_pred)

        results = {
            'threshold': threshold,
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'roc_auc': roc_auc,
            'optimal_threshold': float(optimal_threshold),
            'confusion_matrix': cm.tolist(),
            'total_samples': len(y_true),
            'smile_samples': int(y_true.sum()),
            'non_smile_samples': int(len(y_true) - y_true.sum()),
            'fpr': fpr.tolist(),
            'tpr': tpr.tolist(),
            'thresholds': thresholds.tolist(),
            'y_true': y_true.tolist(),
            'y_scores': y_scores.tolist()
        }

        return results

    def print_results(self, results: dict):
        """결과 출력"""
        print("\n" + "=" * 50)
        print("BASELINE MODEL EVALUATION RESULTS")
        print("=" * 50)

        print(f"\nDataset:")
        print(f"  Total samples: {results['total_samples']}")
        print(f"  Smile: {results['smile_samples']}")
        print(f"  Non-smile: {results['non_smile_samples']}")

        print(f"\nMetrics (threshold={results['threshold']}):")
        print(f"  Accuracy:  {results['accuracy']:.4f} ({results['accuracy']*100:.2f}%)")
        print(f"  Precision: {results['precision']:.4f} ({results['precision']*100:.2f}%)")
        print(f"  Recall:    {results['recall']:.4f} ({results['recall']*100:.2f}%)")
        print(f"  F1 Score:  {results['f1_score']:.4f} ({results['f1_score']*100:.2f}%)")
        print(f"  ROC AUC:   {results['roc_auc']:.4f}")

        print(f"\nOptimal Threshold: {results['optimal_threshold']:.4f}")

        print(f"\nConfusion Matrix:")
        cm = results['confusion_matrix']
        print(f"                 Predicted")
        print(f"                 Non-Smile  Smile")
        print(f"  Actual Non-Smile    {cm[0][0]:4d}    {cm[0][1]:4d}")
        print(f"  Actual Smile        {cm[1][0]:4d}    {cm[1][1]:4d}")

        print("=" * 50)

    def plot_roc_curve(self, results: dict, save_path: str = None, title: str = None):
        """ROC 커브 시각화"""
        plt.figure(figsize=(8, 6))
        plt.plot(results['fpr'], results['tpr'],
                 color='blue', lw=2,
                 label=f"ROC curve (AUC = {results['roc_auc']:.4f})")
        plt.plot([0, 1], [0, 1], color='gray', lw=1, linestyle='--', label='Random')

        # Optimal point 표시
        opt_idx = np.argmax(np.array(results['tpr']) - np.array(results['fpr']))
        plt.scatter(results['fpr'][opt_idx], results['tpr'][opt_idx],
                   color='red', s=100, zorder=5,
                   label=f"Optimal (threshold={results['optimal_threshold']:.3f})")

        plt.xlim([0.0, 1.0])
        plt.ylim([0.0, 1.05])
        plt.xlabel('False Positive Rate')
        plt.ylabel('True Positive Rate')
        plt.title(title or 'ROC Curve')
        plt.legend(loc='lower right')
        plt.grid(True, alpha=0.3)

        if save_path:
            plt.savefig(save_path, dpi=150, bbox_inches='tight')
            print(f"ROC curve saved: {save_path}")

        plt.close()

    def save_results(self, results: dict, output_dir: str = None, title: str = None):
        """결과 저장 (JSON + 그래프)"""
        if output_dir is None:
            output_dir = self.data_dir.parent / "evaluation"

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # JSON 저장 (ROC 데이터 제외한 요약)
        summary = {k: v for k, v in results.items()
                   if k not in ['fpr', 'tpr', 'thresholds', 'y_true', 'y_scores']}

        json_path = output_path / f"baseline_results_{timestamp}.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        print(f"Results saved: {json_path}")

        # ROC 커브 저장
        roc_path = output_path / f"baseline_roc_{timestamp}.png"
        self.plot_roc_curve(results, str(roc_path), title=title)

        return json_path, roc_path


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Evaluate baseline ONNX model")
    parser.add_argument("--model", "-m", type=str, default=None,
                       help="Path to ONNX model")
    parser.add_argument("--data", "-d", type=str, default=None,
                       help="Path to collected data directory")
    parser.add_argument("--threshold", "-t", type=float, default=0.5,
                       help="Classification threshold")
    parser.add_argument("--save", "-s", action="store_true",
                       help="Save results to file")
    parser.add_argument("--title", type=str, default=None,
                       help="Title for ROC curve plot")

    args = parser.parse_args()

    evaluator = BaselineEvaluator(
        model_path=args.model,
        data_dir=args.data
    )

    results = evaluator.evaluate(threshold=args.threshold)
    evaluator.print_results(results)

    if args.save:
        evaluator.save_results(results, title=args.title)


if __name__ == "__main__":
    main()
