"""
Dual-Head 모델 학습 Trainer
"""
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from pathlib import Path
import time
from tqdm import tqdm
import json


class DualHeadTrainer:
    """
    Dual-Head 모델 학습 Trainer

    Features:
    - Masked Multi-task Loss
    - Early Stopping
    - Checkpoint 저장
    - TensorBoard 로깅 (옵션)
    - Learning Rate Scheduler
    """

    def __init__(
        self,
        model,
        criterion,
        optimizer,
        device='cuda',
        checkpoint_dir='checkpoints',
        use_tensorboard=False
    ):
        """
        Args:
            model: DualHeadSmileDetector 모델
            criterion: MultiTaskLoss
            optimizer: PyTorch optimizer
            device: 'cuda' or 'cpu'
            checkpoint_dir: 체크포인트 저장 디렉토리
            use_tensorboard: TensorBoard 사용 여부
        """
        self.model = model.to(device)
        self.criterion = criterion
        self.optimizer = optimizer
        self.device = device
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)

        # TensorBoard
        self.use_tensorboard = use_tensorboard
        self.writer = None
        if use_tensorboard:
            try:
                from torch.utils.tensorboard import SummaryWriter
                self.writer = SummaryWriter(log_dir='logs/tensorboard')
            except ImportError:
                print("⚠ TensorBoard not available, logging disabled")
                self.use_tensorboard = False

        # 학습 기록
        self.history = {
            'train_loss': [],
            'train_head1_loss': [],
            'train_head2_loss': [],
            'val_loss': [],
            'val_head1_loss': [],
            'val_head2_loss': [],
            'learning_rate': []
        }

        self.best_val_loss = float('inf')
        self.epochs_without_improvement = 0

    def train_epoch(self, dataloader, epoch):
        """
        1 Epoch 학습

        Args:
            dataloader: 학습 DataLoader
            epoch: 현재 epoch 번호

        Returns:
            dict: 평균 loss 값들
        """
        self.model.train()

        total_loss = 0.0
        total_head1_loss = 0.0
        total_head2_loss = 0.0
        num_batches = 0

        pbar = tqdm(dataloader, desc=f"Epoch {epoch} [Train]")

        for batch in pbar:
            # 데이터를 device로 이동
            images = batch['images'].to(self.device)
            smile_labels = batch['smile_labels'].to(self.device)
            emotion_labels = batch['emotion_labels'].to(self.device)
            head1_masks = batch['head1_masks'].to(self.device)
            head2_masks = batch['head2_masks'].to(self.device)

            # Forward pass
            smile_pred, emotion_pred = self.model(images)

            # Loss 계산
            losses = self.criterion(
                smile_pred=smile_pred,
                emotion_pred=emotion_pred,
                smile_target=smile_labels,
                emotion_target=emotion_labels,
                head1_mask=head1_masks,
                head2_mask=head2_masks
            )

            loss = losses['total_loss']

            # Backward pass
            self.optimizer.zero_grad()
            loss.backward()

            # Gradient clipping (옵션)
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)

            self.optimizer.step()

            # 통계
            total_loss += loss.item()
            total_head1_loss += losses['head1_masked_loss'].item()
            total_head2_loss += losses['head2_masked_loss'].item()
            num_batches += 1

            # Progress bar 업데이트
            pbar.set_postfix({
                'loss': f"{loss.item():.4f}",
                'h1': f"{losses['head1_masked_loss'].item():.4f}",
                'h2': f"{losses['head2_masked_loss'].item():.4f}"
            })

        # 평균 계산
        avg_loss = total_loss / num_batches
        avg_head1_loss = total_head1_loss / num_batches
        avg_head2_loss = total_head2_loss / num_batches

        return {
            'loss': avg_loss,
            'head1_loss': avg_head1_loss,
            'head2_loss': avg_head2_loss
        }

    def validate(self, dataloader, epoch):
        """
        Validation

        Args:
            dataloader: 검증 DataLoader
            epoch: 현재 epoch 번호

        Returns:
            dict: 평균 loss 값들
        """
        self.model.eval()

        total_loss = 0.0
        total_head1_loss = 0.0
        total_head2_loss = 0.0
        num_batches = 0

        pbar = tqdm(dataloader, desc=f"Epoch {epoch} [Val]")

        with torch.no_grad():
            for batch in pbar:
                # 데이터를 device로 이동
                images = batch['images'].to(self.device)
                smile_labels = batch['smile_labels'].to(self.device)
                emotion_labels = batch['emotion_labels'].to(self.device)
                head1_masks = batch['head1_masks'].to(self.device)
                head2_masks = batch['head2_masks'].to(self.device)

                # Forward pass
                smile_pred, emotion_pred = self.model(images)

                # Loss 계산
                losses = self.criterion(
                    smile_pred=smile_pred,
                    emotion_pred=emotion_pred,
                    smile_target=smile_labels,
                    emotion_target=emotion_labels,
                    head1_mask=head1_masks,
                    head2_mask=head2_masks
                )

                loss = losses['total_loss']

                # 통계
                total_loss += loss.item()
                total_head1_loss += losses['head1_masked_loss'].item()
                total_head2_loss += losses['head2_masked_loss'].item()
                num_batches += 1

                # Progress bar 업데이트
                pbar.set_postfix({
                    'loss': f"{loss.item():.4f}",
                    'h1': f"{losses['head1_masked_loss'].item():.4f}",
                    'h2': f"{losses['head2_masked_loss'].item():.4f}"
                })

        # 평균 계산
        avg_loss = total_loss / num_batches
        avg_head1_loss = total_head1_loss / num_batches
        avg_head2_loss = total_head2_loss / num_batches

        return {
            'loss': avg_loss,
            'head1_loss': avg_head1_loss,
            'head2_loss': avg_head2_loss
        }

    def fit(
        self,
        train_loader,
        val_loader,
        epochs,
        scheduler=None,
        early_stopping_patience=10,
        save_best_only=True
    ):
        """
        전체 학습 루프

        Args:
            train_loader: 학습 DataLoader
            val_loader: 검증 DataLoader
            epochs: 총 epoch 수
            scheduler: Learning rate scheduler (옵션)
            early_stopping_patience: Early stopping patience
            save_best_only: Best 모델만 저장할지 여부
        """
        print("\n" + "=" * 60)
        print("학습 시작")
        print("=" * 60)
        print(f"Device: {self.device}")
        print(f"Epochs: {epochs}")
        print(f"Train batches: {len(train_loader)}")
        print(f"Val batches: {len(val_loader)}")
        print("=" * 60 + "\n")

        start_time = time.time()

        for epoch in range(1, epochs + 1):
            # 학습
            train_metrics = self.train_epoch(train_loader, epoch)

            # 검증
            val_metrics = self.validate(val_loader, epoch)

            # Learning rate
            current_lr = self.optimizer.param_groups[0]['lr']

            # Scheduler 업데이트
            if scheduler is not None:
                scheduler.step(val_metrics['loss'])

            # 기록
            self.history['train_loss'].append(train_metrics['loss'])
            self.history['train_head1_loss'].append(train_metrics['head1_loss'])
            self.history['train_head2_loss'].append(train_metrics['head2_loss'])
            self.history['val_loss'].append(val_metrics['loss'])
            self.history['val_head1_loss'].append(val_metrics['head1_loss'])
            self.history['val_head2_loss'].append(val_metrics['head2_loss'])
            self.history['learning_rate'].append(current_lr)

            # TensorBoard 로깅
            if self.use_tensorboard:
                self.writer.add_scalars('Loss', {
                    'train': train_metrics['loss'],
                    'val': val_metrics['loss']
                }, epoch)
                self.writer.add_scalars('Head1_Loss', {
                    'train': train_metrics['head1_loss'],
                    'val': val_metrics['head1_loss']
                }, epoch)
                self.writer.add_scalars('Head2_Loss', {
                    'train': train_metrics['head2_loss'],
                    'val': val_metrics['head2_loss']
                }, epoch)
                self.writer.add_scalar('Learning_Rate', current_lr, epoch)

            # 출력
            print(f"\nEpoch {epoch}/{epochs}")
            print(f"  Train Loss: {train_metrics['loss']:.4f} "
                  f"(H1: {train_metrics['head1_loss']:.4f}, "
                  f"H2: {train_metrics['head2_loss']:.4f})")
            print(f"  Val Loss:   {val_metrics['loss']:.4f} "
                  f"(H1: {val_metrics['head1_loss']:.4f}, "
                  f"H2: {val_metrics['head2_loss']:.4f})")
            print(f"  LR: {current_lr:.6f}")

            # Best 모델 저장
            if val_metrics['loss'] < self.best_val_loss:
                self.best_val_loss = val_metrics['loss']
                self.epochs_without_improvement = 0

                self.save_checkpoint(
                    epoch=epoch,
                    val_loss=val_metrics['loss'],
                    filename='best_model.pth'
                )
                print(f"  [OK] Best model saved! (val_loss: {val_metrics['loss']:.4f})")
            else:
                self.epochs_without_improvement += 1

            # 매 epoch 저장 (옵션)
            if not save_best_only:
                self.save_checkpoint(
                    epoch=epoch,
                    val_loss=val_metrics['loss'],
                    filename=f'checkpoint_epoch_{epoch}.pth'
                )

            # Early stopping
            if self.epochs_without_improvement >= early_stopping_patience:
                print(f"\n⚠ Early stopping! No improvement for {early_stopping_patience} epochs")
                break

        # 학습 완료
        elapsed_time = time.time() - start_time
        print("\n" + "=" * 60)
        print("학습 완료!")
        print("=" * 60)
        print(f"총 소요 시간: {elapsed_time / 60:.2f}분")
        print(f"Best validation loss: {self.best_val_loss:.4f}")
        print("=" * 60)

        # History 저장
        self.save_history()

        if self.use_tensorboard:
            self.writer.close()

    def save_checkpoint(self, epoch, val_loss, filename='checkpoint.pth'):
        """체크포인트 저장"""
        checkpoint_path = self.checkpoint_dir / filename

        torch.save({
            'epoch': epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'val_loss': val_loss,
            'best_val_loss': self.best_val_loss,
            'history': self.history
        }, checkpoint_path)

    def load_checkpoint(self, filename='best_model.pth'):
        """체크포인트 로드"""
        checkpoint_path = self.checkpoint_dir / filename

        if not checkpoint_path.exists():
            raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

        checkpoint = torch.load(checkpoint_path, map_location=self.device)

        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.best_val_loss = checkpoint['best_val_loss']
        self.history = checkpoint['history']

        print(f"[OK] Checkpoint loaded: {filename}")
        print(f"  Epoch: {checkpoint['epoch']}")
        print(f"  Val loss: {checkpoint['val_loss']:.4f}")

    def save_history(self):
        """학습 기록 저장"""
        history_path = self.checkpoint_dir / 'training_history.json'

        with open(history_path, 'w') as f:
            json.dump(self.history, f, indent=2)

        print(f"[OK] Training history saved: {history_path}")
