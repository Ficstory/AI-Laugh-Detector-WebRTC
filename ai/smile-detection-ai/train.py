"""
Dual-Head 모델 학습 스크립트
GENKI-4K + FER2013 + SMILES 학습
"""
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import ReduceLROnPlateau
import sys
import os
from pathlib import Path
import argparse
import mlflow
import mlflow.pytorch

# Windows 콘솔 인코딩 설정
if sys.platform == 'win32':
    os.system('chcp 65001 > nul')
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from models import build_dual_head_model
from data import (
    GENKI4KDataset,
    FER2013Dataset,
    SMILESDataset,
    create_multi_dataloader,
    create_balanced_dataloader,
    get_genki4k_transforms,
    get_fer2013_transforms,
    get_smiles_transforms
)
from training import MultiTaskLoss, DualHeadTrainer
from utils import load_config


def parse_args():
    """명령줄 인자 파싱"""
    # 프로젝트 루트 경로 (train.py 위치 기준)
    project_root = Path(__file__).parent
    default_config = str(project_root / 'config.yaml')

    parser = argparse.ArgumentParser(description='Dual-Head 모델 학습')
    parser.add_argument('--config', type=str, default=default_config, help='설정 파일 경로')
    parser.add_argument('--batch-size', type=int, default=None, help='배치 크기')
    parser.add_argument('--epochs', type=int, default=None, help='Epoch 수')
    parser.add_argument('--lr', type=float, default=None, help='Learning rate')
    parser.add_argument('--device', type=str, default=None, help='Device (cuda/cpu)')
    parser.add_argument('--checkpoint', type=str, default=None, help='체크포인트 경로 (재시작)')
    parser.add_argument('--no-smiles', action='store_true', help='SMILES 데이터셋 사용 안 함')
    parser.add_argument('--balanced', action='store_true', help='Balanced Sampling 사용 (Head 1:2 = 50:50)')
    parser.add_argument('--ratio', type=float, default=0.5, help='Balanced Sampling 비율 (Head 1 비율)')
    return parser.parse_args()


def create_dataloaders(config, use_smiles=True, balanced=False, ratio=0.5):
    """데이터 로더 생성"""
    print("\n" + "=" * 60)
    print("데이터 로더 생성")
    print("=" * 60)

    data_config = config.data
    training_config = config.training

    image_size = tuple(data_config.get('image_size', [224, 224]))
    batch_size = training_config.get('batch_size', 32)

    # GENKI-4K (Train/Val split)
    print("\n[1/3] GENKI-4K 로딩...")
    from torch.utils.data import random_split

    genki_full = GENKI4KDataset(
        root_dir="data/raw/genki4k",
        transform=get_genki4k_transforms(image_size=image_size, augment=False)
    )

    # 80% Train, 20% Val split
    genki_train_size = int(0.8 * len(genki_full))
    genki_val_size = len(genki_full) - genki_train_size
    genki_dataset, genki_val_dataset = random_split(
        genki_full,
        [genki_train_size, genki_val_size],
        generator=torch.manual_seed(42)  # Reproducibility
    )

    print(f"  - Train: {len(genki_dataset):,} samples")
    print(f"  - Val: {len(genki_val_dataset):,} samples")

    # FER2013
    print("\n[2/3] FER2013 로딩...")
    fer_train_dataset = FER2013Dataset(
        root_dir="data/raw/fer2013",
        split="train",
        transform=get_fer2013_transforms(image_size=image_size, augment=True)
    )

    fer_test_dataset = FER2013Dataset(
        root_dir="data/raw/fer2013",
        split="test",
        transform=get_fer2013_transforms(image_size=image_size, augment=False)
    )

    # SMILES (옵션)
    smiles_dataset = None
    if use_smiles:
        print("\n[3/3] SMILES 로딩...")
        try:
            smiles_dataset = SMILESDataset(
                root_dir="data/raw/smiles/smiles",
                transform=get_smiles_transforms(image_size=image_size, augment=True)
            )
        except Exception as e:
            print(f"⚠ SMILES 로딩 실패: {e}")
            print("  SMILES 없이 계속...")
    else:
        print("\n[3/3] SMILES 건너뜀 (--no-smiles)")

    # Train Dataloader (Balanced 또는 일반)
    if balanced:
        print(f"\n⚖ Balanced Sampling 사용 (ratio={ratio:.0%})")
        train_loader = create_balanced_dataloader(
            genki4k_dataset=genki_dataset,
            fer2013_dataset=fer_train_dataset,
            smiles_dataset=smiles_dataset,
            batch_size=batch_size,
            ratio=ratio,
            num_workers=0,  # Windows에서는 0 권장
            pin_memory=True
        )
    else:
        train_loader = create_multi_dataloader(
            genki4k_dataset=genki_dataset,
            fer2013_dataset=fer_train_dataset,
            smiles_dataset=smiles_dataset,
            batch_size=batch_size,
            shuffle=True,
            num_workers=0,  # Windows에서는 0 권장
            pin_memory=True
        )

    # Validation Dataloader (GENKI val + FER2013 test)
    print("\n" + "=" * 60)
    print("Validation Loader 생성")
    print("=" * 60)
    from torch.utils.data import DataLoader, ConcatDataset
    from data import collate_fn_multi

    # GENKI val + FER2013 test 결합
    val_multi_dataset = ConcatDataset([genki_val_dataset, fer_test_dataset])

    val_loader = DataLoader(
        val_multi_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=True,
        collate_fn=collate_fn_multi
    )

    print(f"  - genki4k val: {len(genki_val_dataset):,} samples")
    print(f"  - fer2013 test: {len(fer_test_dataset):,} samples")
    print(f"✓ Total samples: {len(val_multi_dataset):,}")
    print(f"✓ Batch size: {batch_size}")
    print(f"✓ Total batches: {len(val_loader):,}")
    print("=" * 60)

    return train_loader, val_loader


def main():
    """메인 함수"""
    args = parse_args()

    # 설정 로드
    print("\n" + "=" * 60)
    print("설정 로드")
    print("=" * 60)
    config = load_config(args.config)

    # 명령줄 인자로 설정 오버라이드
    training_config = config.training

    if args.batch_size is not None:
        training_config['batch_size'] = args.batch_size
    if args.epochs is not None:
        training_config['epochs'] = args.epochs
    if args.lr is not None:
        training_config['learning_rate'] = args.lr

    # Device 설정
    if args.device is not None:
        device = args.device
    else:
        device = 'cuda' if torch.cuda.is_available() else 'cpu'

    print(f"✓ Device: {device}")
    print(f"✓ Batch size: {training_config['batch_size']}")
    print(f"✓ Epochs: {training_config['epochs']}")
    print(f"✓ Learning rate: {training_config['learning_rate']}")

    # MLflow 실험 시작
    mlflow.set_experiment("smile-detector-baseline")
    mlflow.start_run(run_name="baseline-training")

    # 데이터 로더 생성
    train_loader, val_loader = create_dataloaders(
        config,
        use_smiles=not args.no_smiles,
        balanced=args.balanced,
        ratio=args.ratio
    )

    # 모델 생성
    print("\n" + "=" * 60)
    print("모델 생성")
    print("=" * 60)
    model = build_dual_head_model(config.model)

    params = model.get_num_params()
    print(f"✓ 모델 생성 완료")
    print(f"  Total parameters: {params['total']:,}")
    print(f"  Trainable parameters: {params['trainable']:,}")

    # Loss function
    loss_config = training_config.get('loss', {})
    criterion = MultiTaskLoss(
        head1_weight=loss_config.get('head1_weight', 1.0),
        head2_weight=loss_config.get('head2_weight', 1.0),
        focal_loss=loss_config.get('focal_loss', False),
        focal_gamma=loss_config.get('focal_gamma', 2.0),
        label_smoothing=loss_config.get('label_smoothing', 0.1)
    )

    # Optimizer
    optimizer = optim.Adam(
        model.parameters(),
        lr=training_config['learning_rate'],
        weight_decay=training_config.get('weight_decay', 0.0001)
    )

    # Scheduler
    scheduler = ReduceLROnPlateau(
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
        device=device,
        checkpoint_dir=training_config.get('checkpoint_dir', 'checkpoints'),
        use_tensorboard=False  # 필요 시 True
    )

    # MLflow 파라미터 로깅
    mlflow.log_params({
        "batch_size": training_config['batch_size'],
        "epochs": training_config['epochs'],
        "learning_rate": training_config['learning_rate'],
        "weight_decay": training_config.get('weight_decay', 0.0001),
        "device": device,
        "backbone": config.model.get('backbone', 'mobilenet_v3_small'),
        "lstm_hidden_size": config.model.get('lstm', {}).get('hidden_size', 128),
        "head1_weight": loss_config.get('head1_weight', 1.0),
        "head2_weight": loss_config.get('head2_weight', 1.0),
        "use_smiles": not args.no_smiles,
        "balanced_sampling": args.balanced,
    })
    mlflow.set_tag("experiment_type", "baseline")
    mlflow.set_tag("dataset", "GENKI-4K + FER2013" + (" + SMILES" if not args.no_smiles else ""))

    # 체크포인트 재시작 (옵션)
    if args.checkpoint is not None:
        trainer.load_checkpoint(args.checkpoint)

    # 학습 시작
    history = trainer.fit(
        train_loader=train_loader,
        val_loader=val_loader,
        epochs=training_config['epochs'],
        scheduler=scheduler,
        early_stopping_patience=training_config.get('early_stopping', {}).get('patience', 10),
        save_best_only=training_config.get('save_best_only', True)
    )

    # MLflow 메트릭 로깅 (에포크별)
    if history:
        for epoch in range(len(history.get('train_loss', []))):
            mlflow.log_metrics({
                "train_loss": history['train_loss'][epoch],
                "train_head1_loss": history['train_head1_loss'][epoch],
                "train_head2_loss": history['train_head2_loss'][epoch],
                "val_loss": history['val_loss'][epoch],
                "val_head1_loss": history['val_head1_loss'][epoch],
                "val_head2_loss": history['val_head2_loss'][epoch],
                "learning_rate": history.get('learning_rate', [training_config['learning_rate']])[epoch]
            }, step=epoch)

        # 최종 메트릭 로깅
        mlflow.log_metrics({
            "final_train_loss": history['train_loss'][-1],
            "final_val_loss": history['val_loss'][-1],
            "best_val_loss": min(history['val_loss'])
        })

    # 모델 및 아티팩트 로깅
    best_model_path = trainer.checkpoint_dir / 'best_model.pth'
    mlflow.log_artifact(str(best_model_path))

    history_path = trainer.checkpoint_dir / 'training_history.json'
    if history_path.exists():
        mlflow.log_artifact(str(history_path))

    # MLflow 종료
    mlflow.end_run()

    print("\n✅ 학습 완료!")
    print(f"Best model: {best_model_path}")
    print(f"MLflow run logged successfully!")


if __name__ == "__main__":
    main()
