"""
파인튜닝 스크립트
- data/collected/ 데이터로 PyTorch 모델 파인튜닝
- ONNX로 변환
- Baseline과 성능 비교
"""

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import cv2
import numpy as np
import csv
from pathlib import Path
from datetime import datetime
import sys
import json
from sklearn.model_selection import train_test_split
import mlflow
import mlflow.pytorch

# 프로젝트 경로 추가
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent
sys.path.insert(0, str(project_root / "src"))

from models.smile_detector_dual import DualHeadSmileDetector
from training.loss import MultiTaskLoss
from training.trainer import DualHeadTrainer


class CollectedDataset(Dataset):
    """
    data/collected/ 데이터셋
    - CSV 파일로부터 시퀀스 로드
    - 5프레임 시퀀스 학습
    """

    def __init__(self, csv_path: str, images_dir: str, split_indices: list = None):
        """
        Args:
            csv_path: labels.csv 경로
            images_dir: 이미지 디렉토리 경로
            split_indices: 사용할 인덱스 리스트 (train/val split용)
        """
        self.images_dir = Path(images_dir)
        self.csv_path = Path(csv_path)

        # CSV 로드
        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            all_rows = list(reader)

        # split_indices가 있으면 해당 인덱스만 사용
        if split_indices is not None:
            self.rows = [all_rows[i] for i in split_indices]
        else:
            self.rows = all_rows

        # 전처리 설정
        self.img_size = (224, 224)
        self.mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        self.std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    def preprocess_image(self, img_path: Path) -> np.ndarray:
        """이미지 전처리 (224x224, 정규화, CHW)"""
        img = cv2.imread(str(img_path))
        if img is None:
            raise FileNotFoundError(f"Image not found: {img_path}")
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, self.img_size)

        # 정규화: 0~255 -> 0~1 -> ImageNet 표준화
        img = img.astype(np.float32) / 255.0
        img = (img - self.mean) / self.std

        # HWC -> CHW
        img = img.transpose(2, 0, 1)

        return img

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, idx: int):
        row = self.rows[idx]

        # 5프레임 시퀀스 로드
        frames = []
        for i in range(5):
            img_path = self.images_dir / row[f'frame_{i}']
            frame = self.preprocess_image(img_path)
            frames.append(frame)

        # (5, 3, 224, 224)
        sequence = np.stack(frames, axis=0).astype(np.float32)

        # 라벨 (smile=1, non_smile=0)
        smile_label = 1.0 if row['label'] == 'smile' else 0.0

        return {
            'images': torch.from_numpy(sequence),  # (5, 3, 224, 224)
            'smile_labels': torch.tensor([smile_label], dtype=torch.float32),  # (1,)
            'emotion_labels': torch.tensor(0, dtype=torch.long),  # Dummy (Head2는 사용 안 함) - scalar
            'head1_masks': torch.tensor([1.0], dtype=torch.float32),  # Head1 활성화
            'head2_masks': torch.tensor([0.0], dtype=torch.float32),  # Head2 비활성화
        }


def load_baseline_model(onnx_path: Path, config: dict, device: str = 'cpu', baseline_pth: Path = None):
    """
    Baseline PyTorch 모델 가중치 로드 (진짜 파인튜닝)

    Args:
        onnx_path: Baseline ONNX 경로 (참고용, 사용 안 함)
        config: 모델 설정
        device: 디바이스
        baseline_pth: Baseline PyTorch 모델 경로 (*.pth)
    """
    print(f"\n{'='*60}")
    print("Baseline 모델 가중치 로드 (진짜 파인튜닝)")
    print(f"{'='*60}")

    model = DualHeadSmileDetector(config)
    print(f"[OK] DualHeadSmileDetector 생성 완료")

    # Baseline 가중치 로드
    if baseline_pth is not None and baseline_pth.exists():
        print(f"\n✅ Baseline 가중치 로드 중...")
        print(f"  경로: {baseline_pth}")
        checkpoint = torch.load(baseline_pth, map_location=device)

        # Checkpoint 형식 확인 (전체 checkpoint vs state_dict만)
        if 'model_state_dict' in checkpoint:
            # 전체 checkpoint 형식
            model.load_state_dict(checkpoint['model_state_dict'])
            print(f"  [OK] Checkpoint에서 가중치 로드 완료!")
            if 'epoch' in checkpoint:
                print(f"  Baseline epoch: {checkpoint['epoch']}")
        else:
            # 단순 state_dict 형식
            model.load_state_dict(checkpoint)
            print(f"  [OK] 가중치 로드 완료!")

        print(f"  이제 낮은 learning rate로 파인튜닝 시작합니다.")
    else:
        print(f"\n⚠️  Baseline 가중치 파일 없음: {baseline_pth}")
        print(f"  처음부터 학습합니다 (파인튜닝 아님)")

    # 파라미터 수 출력
    params = model.get_num_params()
    print(f"\n모델 파라미터:")
    print(f"  Total: {params['total']:,}")
    print(f"  Trainable: {params['trainable']:,}")
    print(f"  Backbone: {params['backbone']:,}")
    print(f"  LSTM: {params['lstm']:,}")
    print(f"  Smile Head: {params['smile_head']:,}")
    print(f"  Emotion Head: {params['emotion_head']:,}")

    return model


def save_to_onnx(model, save_path: Path, device: str = 'cpu'):
    """PyTorch 모델을 ONNX로 변환"""
    print(f"\n{'='*60}")
    print("ONNX 변환")
    print(f"{'='*60}")

    model.eval()
    model.to(device)

    # Dummy input: (batch=1, seq=5, channels=3, height=224, width=224)
    dummy_input = torch.randn(1, 5, 3, 224, 224, device=device)

    # ONNX 변환
    torch.onnx.export(
        model,
        dummy_input,
        str(save_path),
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['smile_prob', 'emotion_logits'],
        dynamic_axes={
            'input': {0: 'batch_size'},
            'smile_prob': {0: 'batch_size'},
            'emotion_logits': {0: 'batch_size'}
        }
    )

    print(f"[OK] ONNX 모델 저장: {save_path}")
    print(f"  Input shape: (batch, 5, 3, 224, 224)")
    print(f"  Output 1 (smile_prob): (batch, 1)")
    print(f"  Output 2 (emotion_logits): (batch, 7)")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Fine-tune smile detector model")
    parser.add_argument("--data", "-d", type=str, default=None,
                       help="Path to collected data directory (default: data/collected)")
    parser.add_argument("--epochs", "-e", type=int, default=30,
                       help="Number of epochs (default: 30)")
    parser.add_argument("--batch-size", "-b", type=int, default=16,
                       help="Batch size (default: 16)")
    parser.add_argument("--lr", type=float, default=1e-4,
                       help="Learning rate (default: 1e-4)")
    parser.add_argument("--device", type=str, default='cuda' if torch.cuda.is_available() else 'cpu',
                       help="Device (cuda or cpu)")
    parser.add_argument("--val-split", type=float, default=0.2,
                       help="Validation split ratio (default: 0.2)")
    parser.add_argument("--checkpoint-dir", type=str, default=None,
                       help="Checkpoint directory (default: checkpoints)")

    args = parser.parse_args()

    # 경로 설정
    if args.data is None:
        data_dir = project_root / "data" / "collected"
    else:
        data_dir = Path(args.data)

    if args.checkpoint_dir is None:
        checkpoint_dir = project_root / "checkpoints" / f"finetune_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    else:
        checkpoint_dir = Path(args.checkpoint_dir)

    csv_path = data_dir / "labels.csv"
    images_dir = data_dir / "images"
    baseline_onnx = project_root / "models" / "smile_detector.onnx"
    baseline_pth = project_root / "checkpoints" / "baseline_pretrained.pth"

    print(f"\n{'='*60}")
    print("파인튜닝 설정")
    print(f"{'='*60}")
    print(f"Data directory: {data_dir}")
    print(f"CSV path: {csv_path}")
    print(f"Images directory: {images_dir}")
    print(f"Baseline ONNX: {baseline_onnx}")
    print(f"Baseline PTH: {baseline_pth}")
    print(f"Checkpoint directory: {checkpoint_dir}")
    print(f"Device: {args.device}")
    print(f"Epochs: {args.epochs}")
    print(f"Batch size: {args.batch_size}")

    # MLflow 실험 시작
    mlflow.set_experiment("smile-detector-finetuning")
    mlflow.start_run(run_name=f"finetuning-{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    print(f"Learning rate: {args.lr}")
    print(f"Validation split: {args.val_split}")
    print(f"{'='*60}")

    # 모델 설정
    model_config = {
        'backbone': 'mobilenet_v3_small',
        'pretrained': True,
        'freeze_backbone': False,  # 파인튜닝이므로 백본도 학습
        'cnn': {
            'output_features': 256,
            'dropout': 0.3
        },
        'lstm': {
            'hidden_size': 128,
            'num_layers': 2,
            'dropout': 0.2,
            'bidirectional': True
        },
        'head1': {
            'hidden_units': [64],
            'dropout': 0.5
        },
        'head2': {
            'num_classes': 7,
            'hidden_units': [128, 64],
            'dropout': 0.5
        }
    }

    # 데이터셋 로드 및 분할
    print(f"\n{'='*60}")
    print("데이터셋 로드")
    print(f"{'='*60}")

    # 전체 데이터 인덱스
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        total_samples = len(list(reader))

    print(f"Total samples: {total_samples}")

    # Train/Val split
    all_indices = list(range(total_samples))
    train_indices, val_indices = train_test_split(
        all_indices,
        test_size=args.val_split,
        random_state=42,
        shuffle=True
    )

    print(f"Train samples: {len(train_indices)}")
    print(f"Val samples: {len(val_indices)}")

    # 데이터셋 생성
    train_dataset = CollectedDataset(csv_path, images_dir, train_indices)
    val_dataset = CollectedDataset(csv_path, images_dir, val_indices)

    # DataLoader 생성
    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,  # Windows에서는 0 권장
        pin_memory=True if args.device == 'cuda' else False
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=True if args.device == 'cuda' else False
    )

    print(f"Train batches: {len(train_loader)}")
    print(f"Val batches: {len(val_loader)}")

    # 모델 로드 (Baseline 가중치 로드)
    model = load_baseline_model(baseline_onnx, model_config, args.device, baseline_pth=baseline_pth)

    # MLflow 파라미터 로깅
    mlflow.log_params({
        "batch_size": args.batch_size,
        "epochs": args.epochs,
        "learning_rate": args.lr,
        "weight_decay": 0.01,
        "device": args.device,
        "val_split": args.val_split,
        "train_samples": len(train_indices),
        "val_samples": len(val_indices),
        "backbone": model_config.get('backbone', 'mobilenet_v3_small'),
        "baseline_loaded": baseline_pth.exists()
    })
    mlflow.set_tag("experiment_type", "finetuning")
    mlflow.set_tag("dataset", "Korean Collected Data")
    mlflow.set_tag("baseline_path", str(baseline_pth))

    # Loss function (Head1만 사용)
    criterion = MultiTaskLoss(
        head1_weight=1.0,
        head2_weight=0.0,  # Head2는 사용 안 함
        focal_loss=False,
        label_smoothing=0.0
    )

    # Optimizer
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.lr,
        weight_decay=0.01
    )

    # Learning Rate Scheduler
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode='min',
        factor=0.5,
        patience=5
    )

    # Trainer
    trainer = DualHeadTrainer(
        model=model,
        criterion=criterion,
        optimizer=optimizer,
        device=args.device,
        checkpoint_dir=str(checkpoint_dir),
        use_tensorboard=False
    )

    # 학습 시작
    history = trainer.fit(
        train_loader=train_loader,
        val_loader=val_loader,
        epochs=args.epochs,
        scheduler=scheduler,
        early_stopping_patience=10,
        save_best_only=True
    )

    # MLflow 메트릭 로깅 (에포크별)
    if history:
        for epoch in range(len(history.get('train_loss', []))):
            mlflow.log_metrics({
                "train_loss": history['train_loss'][epoch],
                "train_head1_loss": history['train_head1_loss'][epoch],
                "val_loss": history['val_loss'][epoch],
                "val_head1_loss": history['val_head1_loss'][epoch],
            }, step=epoch)

        # 최종 메트릭 로깅
        mlflow.log_metrics({
            "final_train_loss": history['train_loss'][-1],
            "final_val_loss": history['val_loss'][-1],
            "best_val_loss": float(trainer.best_val_loss)
        })

    # Best 모델 로드
    print(f"\n{'='*60}")
    print("Best 모델 로드")
    print(f"{'='*60}")
    trainer.load_checkpoint('best_model.pth')

    # ONNX 변환
    onnx_save_path = project_root / "models" / "smile_detector_finetuned.onnx"
    save_to_onnx(trainer.model, onnx_save_path, args.device)

    # 학습 결과 요약 저장
    summary = {
        'timestamp': datetime.now().isoformat(),
        'config': model_config,
        'training': {
            'epochs': args.epochs,
            'batch_size': args.batch_size,
            'learning_rate': args.lr,
            'device': args.device,
            'val_split': args.val_split,
            'train_samples': len(train_indices),
            'val_samples': len(val_indices),
        },
        'best_val_loss': float(trainer.best_val_loss),
        'final_metrics': {
            'train_loss': float(trainer.history['train_loss'][-1]),
            'val_loss': float(trainer.history['val_loss'][-1]),
        }
    }

    summary_path = checkpoint_dir / 'training_summary.json'
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    # MLflow 아티팩트 로깅
    mlflow.log_artifact(str(checkpoint_dir / 'best_model.pth'))
    mlflow.log_artifact(str(onnx_save_path))
    mlflow.log_artifact(str(summary_path))

    history_path = checkpoint_dir / 'training_history.json'
    if history_path.exists():
        mlflow.log_artifact(str(history_path))

    # MLflow 종료
    mlflow.end_run()

    print(f"\n{'='*60}")
    print("파인튜닝 완료!")
    print(f"{'='*60}")
    print(f"Best validation loss: {trainer.best_val_loss:.4f}")
    print(f"ONNX model: {onnx_save_path}")
    print(f"Checkpoint directory: {checkpoint_dir}")
    print(f"Training summary: {summary_path}")
    print(f"MLflow run logged successfully!")
    print(f"\n다음 단계:")
    print(f"  1. 평가 실행: python scripts/evaluate_baseline.py --model {onnx_save_path} --data data/eval")
    print(f"  2. Baseline과 비교")
    print(f"  3. MLflow UI 확인: mlflow ui (http://localhost:5000)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
