"""
진짜 파인튜닝 A/B 테스트 비교 스크립트
- Baseline 모델 (30 epochs, 서양인 데이터)
- Fine-tuned 모델 (10 epochs, 한국인 데이터, baseline 가중치 로드)
- 동일한 한국인 평가 데이터로 성능 비교
"""
import torch
import numpy as np
import csv
import json
from pathlib import Path
from datetime import datetime
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_curve, auc, confusion_matrix
)
import matplotlib.pyplot as plt
import cv2
import sys

# 프로젝트 루트 경로
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from models import DualHeadSmileDetector
from utils import load_config


class ModelComparator:
    """Baseline vs Finetuned 모델 비교"""

    def __init__(self, baseline_pth: str, finetuned_pth: str, data_dir: str, config_path: str):
        self.baseline_pth = Path(baseline_pth)
        self.finetuned_pth = Path(finetuned_pth)
        self.data_dir = Path(data_dir)
        self.config = load_config(config_path)

        # 디바이스 설정
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print(f"✓ Device: {self.device}")

        # 모델 로드
        self.baseline_model = self._load_model(self.baseline_pth, "Baseline")
        self.finetuned_model = self._load_model(self.finetuned_pth, "Finetuned")

        # 평가 데이터 로드
        self.labels_csv = self.data_dir / 'labels.csv'
        if not self.labels_csv.exists():
            raise FileNotFoundError(f"labels.csv not found: {self.labels_csv}")

        print(f"✓ Evaluation data: {self.labels_csv}")

    def _load_model(self, checkpoint_path: Path, model_name: str) -> torch.nn.Module:
        """PyTorch 체크포인트 로드"""
        print(f"\n[{model_name}] 모델 로드 중...")
        print(f"  Path: {checkpoint_path}")

        # 모델 생성
        model = DualHeadSmileDetector(self.config.model)

        # 체크포인트 로드
        checkpoint = torch.load(checkpoint_path, map_location=self.device)

        # state_dict 추출
        if 'model_state_dict' in checkpoint:
            model.load_state_dict(checkpoint['model_state_dict'])
            if 'epoch' in checkpoint:
                print(f"  Trained epochs: {checkpoint['epoch']}")
        else:
            model.load_state_dict(checkpoint)

        model.to(self.device)
        model.eval()
        print(f"  ✓ Loaded successfully!")

        return model

    def preprocess_image(self, img_path: Path) -> np.ndarray:
        """이미지 전처리 (224x224, 정규화)"""
        img = cv2.imread(str(img_path))
        if img is None:
            raise FileNotFoundError(f"Image not found: {img_path}")

        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (224, 224))
        img = img.astype(np.float32) / 255.0

        # 정규화 (ImageNet)
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        img = (img - mean) / std

        # CHW 형식
        img = np.transpose(img, (2, 0, 1))
        return img

    def load_sequence(self, row: dict) -> torch.Tensor:
        """5프레임 시퀀스 로드"""
        frames = []
        for i in range(5):
            frame_filename = row[f'frame_{i}']
            frame_path = self.data_dir / 'images' / frame_filename

            frame = self.preprocess_image(frame_path)
            frames.append(frame)

        # [5, 3, 224, 224]
        sequence = np.stack(frames, axis=0)
        return torch.from_numpy(sequence).float()

    def predict(self, model: torch.nn.Module, sequence: torch.Tensor) -> float:
        """모델 추론 - smile_prob 반환"""
        sequence = sequence.unsqueeze(0).to(self.device)  # [1, 5, 3, 224, 224]

        with torch.no_grad():
            smile_prob, _ = model(sequence)
            smile_prob = smile_prob.squeeze().cpu().item()

        return smile_prob

    def evaluate_model(self, model: torch.nn.Module, model_name: str, threshold: float = 0.5) -> dict:
        """모델 평가"""
        print(f"\n{'='*60}")
        print(f"{model_name} 평가 중...")
        print(f"{'='*60}")

        y_true = []
        y_pred = []
        y_prob = []

        # CSV 읽기
        with open(self.labels_csv, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        total = len(rows)
        print(f"Total sequences: {total}")

        for idx, row in enumerate(rows):
            # 진행 상황
            if (idx + 1) % 20 == 0 or (idx + 1) == total:
                print(f"  Progress: {idx+1}/{total}")

            # 시퀀스 로드
            sequence = self.load_sequence(row)

            # Ground truth
            label_str = row['label']
            true_label = 1 if label_str == 'smile' else 0

            # 예측
            smile_prob = self.predict(model, sequence)
            pred_label = 1 if smile_prob >= threshold else 0

            y_true.append(true_label)
            y_pred.append(pred_label)
            y_prob.append(smile_prob)

        # 메트릭 계산
        accuracy = accuracy_score(y_true, y_pred)
        precision = precision_score(y_true, y_pred, zero_division=0)
        recall = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)

        # ROC/AUC
        fpr, tpr, thresholds = roc_curve(y_true, y_prob)
        roc_auc = auc(fpr, tpr)

        # Optimal threshold (Youden's J statistic)
        j_scores = tpr - fpr
        optimal_idx = np.argmax(j_scores)
        optimal_threshold = thresholds[optimal_idx]

        # Confusion Matrix
        cm = confusion_matrix(y_true, y_pred)
        tn, fp, fn, tp = cm.ravel()

        results = {
            'model_name': model_name,
            'total_samples': total,
            'threshold': threshold,
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'roc_auc': roc_auc,
            'optimal_threshold': optimal_threshold,
            'confusion_matrix': {
                'tn': int(tn), 'fp': int(fp),
                'fn': int(fn), 'tp': int(tp)
            },
            'roc_curve': {
                'fpr': fpr.tolist(),
                'tpr': tpr.tolist(),
                'thresholds': thresholds.tolist()
            }
        }

        return results

    def print_results(self, baseline_results: dict, finetuned_results: dict):
        """결과 비교 출력"""
        print("\n" + "="*80)
        print("📊 A/B 테스트 결과 비교 (진짜 파인튜닝)")
        print("="*80)

        print("\n🔵 Baseline (30 epochs, 서양인 데이터)")
        print(f"  Accuracy:  {baseline_results['accuracy']:.4f} ({baseline_results['accuracy']*100:.2f}%)")
        print(f"  Precision: {baseline_results['precision']:.4f} ({baseline_results['precision']*100:.2f}%)")
        print(f"  Recall:    {baseline_results['recall']:.4f} ({baseline_results['recall']*100:.2f}%)")
        print(f"  F1 Score:  {baseline_results['f1_score']:.4f} ({baseline_results['f1_score']*100:.2f}%)")
        print(f"  ROC AUC:   {baseline_results['roc_auc']:.4f}")

        print("\n🟢 Finetuned (10 epochs, 한국인 데이터, baseline 가중치 로드)")
        print(f"  Accuracy:  {finetuned_results['accuracy']:.4f} ({finetuned_results['accuracy']*100:.2f}%)")
        print(f"  Precision: {finetuned_results['precision']:.4f} ({finetuned_results['precision']*100:.2f}%)")
        print(f"  Recall:    {finetuned_results['recall']:.4f} ({finetuned_results['recall']*100:.2f}%)")
        print(f"  F1 Score:  {finetuned_results['f1_score']:.4f} ({finetuned_results['f1_score']*100:.2f}%)")
        print(f"  ROC AUC:   {finetuned_results['roc_auc']:.4f}")

        print("\n📈 개선율 (Baseline → Finetuned)")
        acc_diff = (finetuned_results['accuracy'] - baseline_results['accuracy']) * 100
        prec_diff = (finetuned_results['precision'] - baseline_results['precision']) * 100
        rec_diff = (finetuned_results['recall'] - baseline_results['recall']) * 100
        f1_diff = (finetuned_results['f1_score'] - baseline_results['f1_score']) * 100
        auc_diff = finetuned_results['roc_auc'] - baseline_results['roc_auc']

        print(f"  Accuracy:  {acc_diff:+.2f}%p {'✅' if acc_diff > 0 else '❌'}")
        print(f"  Precision: {prec_diff:+.2f}%p {'✅' if prec_diff > 0 else '❌'}")
        print(f"  Recall:    {rec_diff:+.2f}%p {'✅' if rec_diff > 0 else '❌'}")
        print(f"  F1 Score:  {f1_diff:+.2f}%p {'✅' if f1_diff > 0 else '❌'}")
        print(f"  ROC AUC:   {auc_diff:+.4f} {'✅' if auc_diff > 0 else '❌'}")

        print("\n" + "="*80)

    def plot_comparison(self, baseline_results: dict, finetuned_results: dict, save_path: str = None):
        """비교 시각화"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

        # 1. 메트릭 비교 바 차트
        metrics = ['Accuracy', 'Precision', 'Recall', 'F1 Score']
        baseline_scores = [
            baseline_results['accuracy'],
            baseline_results['precision'],
            baseline_results['recall'],
            baseline_results['f1_score']
        ]
        finetuned_scores = [
            finetuned_results['accuracy'],
            finetuned_results['precision'],
            finetuned_results['recall'],
            finetuned_results['f1_score']
        ]

        x = np.arange(len(metrics))
        width = 0.35

        ax1.bar(x - width/2, baseline_scores, width, label='Baseline', alpha=0.8, color='#3498db')
        ax1.bar(x + width/2, finetuned_scores, width, label='Finetuned (True FT)', alpha=0.8, color='#2ecc71')

        ax1.set_ylabel('Score')
        ax1.set_title('Baseline vs Finetuned (진짜 파인튜닝)', fontsize=14, fontweight='bold')
        ax1.set_xticks(x)
        ax1.set_xticklabels(metrics)
        ax1.legend()
        ax1.grid(axis='y', alpha=0.3)
        ax1.set_ylim(0, 1.0)

        # 값 표시
        for i, (b, f) in enumerate(zip(baseline_scores, finetuned_scores)):
            ax1.text(i - width/2, b + 0.02, f'{b:.2%}', ha='center', va='bottom', fontsize=9)
            ax1.text(i + width/2, f + 0.02, f'{f:.2%}', ha='center', va='bottom', fontsize=9, color='green' if f > b else 'red')

        # 2. ROC 커브 비교
        ax2.plot(baseline_results['roc_curve']['fpr'],
                baseline_results['roc_curve']['tpr'],
                label=f'Baseline (AUC={baseline_results["roc_auc"]:.4f})',
                linewidth=2, color='#3498db')

        ax2.plot(finetuned_results['roc_curve']['fpr'],
                finetuned_results['roc_curve']['tpr'],
                label=f'Finetuned (AUC={finetuned_results["roc_auc"]:.4f})',
                linewidth=2, color='#2ecc71')

        ax2.plot([0, 1], [0, 1], 'k--', linewidth=1, label='Random Guess')

        ax2.set_xlabel('False Positive Rate')
        ax2.set_ylabel('True Positive Rate')
        ax2.set_title('ROC Curve Comparison', fontsize=14, fontweight='bold')
        ax2.legend(loc='lower right')
        ax2.grid(alpha=0.3)

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"\n✓ 그래프 저장: {save_path}")

        plt.close()

    def save_results(self, baseline_results: dict, finetuned_results: dict, output_dir: str = None):
        """결과 저장"""
        if output_dir is None:
            output_dir = Path(__file__).parent.parent / 'data' / 'evaluation'
        else:
            output_dir = Path(output_dir)

        output_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # JSON 저장
        comparison_data = {
            'timestamp': timestamp,
            'baseline': baseline_results,
            'finetuned': finetuned_results,
            'improvements': {
                'accuracy': (finetuned_results['accuracy'] - baseline_results['accuracy']) * 100,
                'precision': (finetuned_results['precision'] - baseline_results['precision']) * 100,
                'recall': (finetuned_results['recall'] - baseline_results['recall']) * 100,
                'f1_score': (finetuned_results['f1_score'] - baseline_results['f1_score']) * 100,
                'roc_auc': finetuned_results['roc_auc'] - baseline_results['roc_auc']
            }
        }

        json_path = output_dir / f'true_finetuning_comparison_{timestamp}.json'
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(comparison_data, f, indent=2, ensure_ascii=False)
        print(f"✓ JSON 저장: {json_path}")

        # 그래프 저장
        plot_path = output_dir / f'true_finetuning_comparison_{timestamp}.png'
        self.plot_comparison(baseline_results, finetuned_results, str(plot_path))


def main():
    """메인 함수"""
    print("\n" + "="*80)
    print("진짜 파인튜닝 A/B/C 테스트 시작")
    print("="*80)

    # 경로 설정
    project_root = Path(__file__).parent.parent
    baseline_pth = project_root / 'checkpoints' / 'baseline_pretrained.pth'
    finetuned_10ep_pth = project_root / 'checkpoints' / 'finetune_20260130_142854' / 'best_model.pth'
    finetuned_30ep_pth = project_root / 'checkpoints' / 'finetune_20260130_144914' / 'best_model.pth'
    data_dir = project_root / 'data' / 'eval'
    config_path = project_root / 'config.yaml'

    # 파일 존재 확인
    if not baseline_pth.exists():
        print(f"❌ Baseline 모델 없음: {baseline_pth}")
        return 1

    if not data_dir.exists():
        print(f"❌ 평가 데이터 없음: {data_dir}")
        return 1

    # 비교 실행 (Baseline vs 10 epochs)
    print("\n" + "="*80)
    print("1️⃣ Baseline vs Finetuned 10 Epochs")
    print("="*80)

    comparator_10 = ModelComparator(
        baseline_pth=str(baseline_pth),
        finetuned_pth=str(finetuned_10ep_pth),
        data_dir=str(data_dir),
        config_path=str(config_path)
    )

    baseline_results = comparator_10.evaluate_model(comparator_10.baseline_model, "Baseline (30ep, 서양인)", threshold=0.5)
    finetuned_10_results = comparator_10.evaluate_model(comparator_10.finetuned_model, "Finetuned 10ep", threshold=0.5)

    comparator_10.print_results(baseline_results, finetuned_10_results)
    comparator_10.save_results(baseline_results, finetuned_10_results)

    # 30 epochs 모델도 있으면 비교
    if finetuned_30ep_pth.exists():
        print("\n" + "="*80)
        print("2️⃣ Baseline vs Finetuned 30 Epochs")
        print("="*80)

        comparator_30 = ModelComparator(
            baseline_pth=str(baseline_pth),
            finetuned_pth=str(finetuned_30ep_pth),
            data_dir=str(data_dir),
            config_path=str(config_path)
        )

        finetuned_30_results = comparator_30.evaluate_model(comparator_30.finetuned_model, "Finetuned 30ep", threshold=0.5)
        comparator_30.print_results(baseline_results, finetuned_30_results)
        comparator_30.save_results(baseline_results, finetuned_30_results)

        # 3-way 비교
        print("\n" + "="*80)
        print("📊 3-Way 비교: Baseline vs 10ep vs 30ep")
        print("="*80)

        print("\n| 모델 | Accuracy | Precision | Recall | F1 | ROC AUC |")
        print("|------|----------|-----------|--------|-----|---------|")
        print(f"| Baseline | {baseline_results['accuracy']:.4f} | {baseline_results['precision']:.4f} | {baseline_results['recall']:.4f} | {baseline_results['f1_score']:.4f} | {baseline_results['roc_auc']:.4f} |")
        print(f"| Finetuned 10ep | {finetuned_10_results['accuracy']:.4f} | {finetuned_10_results['precision']:.4f} | {finetuned_10_results['recall']:.4f} | {finetuned_10_results['f1_score']:.4f} | {finetuned_10_results['roc_auc']:.4f} |")
        print(f"| Finetuned 30ep | {finetuned_30_results['accuracy']:.4f} | {finetuned_30_results['precision']:.4f} | {finetuned_30_results['recall']:.4f} | {finetuned_30_results['f1_score']:.4f} | {finetuned_30_results['roc_auc']:.4f} |")

        # 최고 성능 모델 찾기
        models = [
            ("Baseline", baseline_results),
            ("Finetuned 10ep", finetuned_10_results),
            ("Finetuned 30ep", finetuned_30_results)
        ]

        best_acc = max(models, key=lambda x: x[1]['accuracy'])
        best_f1 = max(models, key=lambda x: x[1]['f1_score'])

        print(f"\n🏆 최고 Accuracy: {best_acc[0]} ({best_acc[1]['accuracy']:.2%})")
        print(f"🏆 최고 F1 Score: {best_f1[0]} ({best_f1[1]['f1_score']:.2%})")

    print("\n✅ A/B/C 테스트 완료!")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
