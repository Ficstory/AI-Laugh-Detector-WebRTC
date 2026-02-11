"""
평가 지표 계산
정확도, 정밀도, 재현율, F1 스코어 등
"""
import torch
import numpy as np
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix


def calculate_accuracy(predictions: torch.Tensor, targets: torch.Tensor) -> float:
    """
    정확도 계산

    Args:
        predictions: 예측값 (logits 또는 확률)
        targets: 정답 레이블

    Returns:
        정확도 (0.0 ~ 1.0)
    """
    if predictions.dim() > 1:
        predictions = (predictions > 0.5).long().squeeze()
    else:
        predictions = (predictions > 0.5).long()

    correct = (predictions == targets).sum().item()
    total = targets.size(0)

    return correct / total


def calculate_metrics(predictions: np.ndarray, targets: np.ndarray) -> dict:
    """
    다양한 평가 지표 계산

    Args:
        predictions: 예측값 (0 또는 1)
        targets: 정답 레이블 (0 또는 1)

    Returns:
        dict: {
            'accuracy': float,
            'precision': float,
            'recall': float,
            'f1_score': float,
            'confusion_matrix': np.ndarray
        }
    """
    acc = accuracy_score(targets, predictions)
    precision = precision_score(targets, predictions, zero_division=0)
    recall = recall_score(targets, predictions, zero_division=0)
    f1 = f1_score(targets, predictions, zero_division=0)
    cm = confusion_matrix(targets, predictions)

    return {
        'accuracy': acc,
        'precision': precision,
        'recall': recall,
        'f1_score': f1,
        'confusion_matrix': cm
    }


class AverageMeter:
    """평균값 추적 유틸리티"""

    def __init__(self):
        self.reset()

    def reset(self):
        """초기화"""
        self.val = 0
        self.avg = 0
        self.sum = 0
        self.count = 0

    def update(self, val, n=1):
        """
        값 업데이트

        Args:
            val: 추가할 값
            n: 샘플 개수
        """
        self.val = val
        self.sum += val * n
        self.count += n
        self.avg = self.sum / self.count


class MetricsTracker:
    """학습 중 지표 추적"""

    def __init__(self):
        self.loss = AverageMeter()
        self.accuracy = AverageMeter()

    def reset(self):
        """모든 지표 초기화"""
        self.loss.reset()
        self.accuracy.reset()

    def update(self, loss: float, acc: float, batch_size: int = 1):
        """
        지표 업데이트

        Args:
            loss: 손실값
            acc: 정확도
            batch_size: 배치 크기
        """
        self.loss.update(loss, batch_size)
        self.accuracy.update(acc, batch_size)

    def get_metrics(self) -> dict:
        """
        현재 평균 지표 반환

        Returns:
            dict: {'loss': float, 'accuracy': float}
        """
        return {
            'loss': self.loss.avg,
            'accuracy': self.accuracy.avg
        }
