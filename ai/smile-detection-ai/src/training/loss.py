"""
Multi-task Loss Functions
Dual-Head 모델을 위한 Masked Loss 구현
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


class MultiTaskLoss(nn.Module):
    """
    Dual-Head 모델을 위한 Multi-task Loss

    데이터셋별 Masked Loss 전략:
    - GENKI-4K: Head 1 (Smile) Loss만 계산
    - FER2013: Head 2 (Emotion) Loss만 계산
    - 한국인 데이터셋: 두 Loss 모두 계산

    Args:
        head1_weight: Head 1 (Smile) Loss 가중치
        head2_weight: Head 2 (Emotion) Loss 가중치
        focal_loss: Focal Loss 사용 여부 (클래스 불균형 완화)
        label_smoothing: Label Smoothing 비율 (과적합 방지)
    """

    def __init__(
        self,
        head1_weight: float = 1.0,
        head2_weight: float = 1.0,
        focal_loss: bool = False,
        focal_gamma: float = 2.0,
        label_smoothing: float = 0.0
    ):
        super(MultiTaskLoss, self).__init__()

        self.head1_weight = head1_weight
        self.head2_weight = head2_weight
        self.focal_loss = focal_loss
        self.focal_gamma = focal_gamma

        # Head 1: Binary Cross Entropy (Smile Detection)
        self.bce_loss = nn.BCELoss(reduction='none')

        # Head 2: Cross Entropy (Emotion Classification)
        self.ce_loss = nn.CrossEntropyLoss(
            reduction='none',
            label_smoothing=label_smoothing
        )

    def forward(
        self,
        smile_pred: torch.Tensor,
        emotion_pred: torch.Tensor,
        smile_target: torch.Tensor,
        emotion_target: torch.Tensor,
        head1_mask: torch.Tensor,
        head2_mask: torch.Tensor
    ):
        """
        순전파

        Args:
            smile_pred: Head 1 예측 (B, 1), 범위 [0, 1]
            emotion_pred: Head 2 예측 로짓 (B, num_classes)
            smile_target: Head 1 라벨 (B, 1), 범위 [0, 1]
            emotion_target: Head 2 라벨 (B,), 클래스 인덱스
            head1_mask: Head 1 Loss 계산 여부 (B,), 1=계산, 0=무시
            head2_mask: Head 2 Loss 계산 여부 (B,), 1=계산, 0=무시

        Returns:
            dict: {
                'total_loss': 전체 Loss,
                'head1_loss': Head 1 Loss (마스킹 적용 전),
                'head2_loss': Head 2 Loss (마스킹 적용 전),
                'head1_masked_loss': Head 1 Loss (마스킹 적용 후),
                'head2_masked_loss': Head 2 Loss (마스킹 적용 후)
            }
        """
        batch_size = smile_pred.size(0)

        # ========== Head 1: Smile Detection Loss ==========
        if self.focal_loss:
            # Focal Loss (어려운 샘플에 집중)
            bce = self.bce_loss(smile_pred, smile_target)
            pt = torch.exp(-bce)  # 예측 확률
            head1_loss_per_sample = ((1 - pt) ** self.focal_gamma) * bce
        else:
            # Standard Binary Cross Entropy
            head1_loss_per_sample = self.bce_loss(smile_pred, smile_target)

        # Masked Loss 적용
        head1_loss_per_sample = head1_loss_per_sample.squeeze(1)  # (B,)
        head1_masked = head1_loss_per_sample * head1_mask

        # 평균 계산 (마스크가 1인 샘플만)
        num_head1_samples = head1_mask.sum()
        if num_head1_samples > 0:
            head1_loss = head1_masked.sum() / num_head1_samples
        else:
            head1_loss = torch.tensor(0.0, device=smile_pred.device)

        # ========== Head 2: Emotion Classification Loss ==========
        head2_loss_per_sample = self.ce_loss(emotion_pred, emotion_target)

        # Masked Loss 적용
        head2_masked = head2_loss_per_sample * head2_mask

        # 평균 계산 (마스크가 1인 샘플만)
        num_head2_samples = head2_mask.sum()
        if num_head2_samples > 0:
            head2_loss = head2_masked.sum() / num_head2_samples
        else:
            head2_loss = torch.tensor(0.0, device=emotion_pred.device)

        # ========== Total Loss ==========
        total_loss = (
            self.head1_weight * head1_loss +
            self.head2_weight * head2_loss
        )

        return {
            'total_loss': total_loss,
            'head1_loss': head1_loss_per_sample.mean(),  # 마스킹 전 (로깅용)
            'head2_loss': head2_loss_per_sample.mean(),  # 마스킹 전 (로깅용)
            'head1_masked_loss': head1_loss,  # 마스킹 후
            'head2_masked_loss': head2_loss,  # 마스킹 후
        }


class AdaptiveMultiTaskLoss(MultiTaskLoss):
    """
    적응형 Multi-task Loss

    학습 중 두 헤드의 Loss 크기를 관찰하여 자동으로 가중치 조정
    (Uncertainty Weighting 기법)

    참고: "Multi-Task Learning Using Uncertainty to Weigh Losses" (Kendall et al., 2018)
    """

    def __init__(
        self,
        focal_loss: bool = False,
        focal_gamma: float = 2.0,
        label_smoothing: float = 0.0
    ):
        # 초기 가중치는 학습 가능한 파라미터로 설정
        super().__init__(
            head1_weight=1.0,
            head2_weight=1.0,
            focal_loss=focal_loss,
            focal_gamma=focal_gamma,
            label_smoothing=label_smoothing
        )

        # 학습 가능한 불확실성 파라미터 (log(σ²))
        self.log_var_head1 = nn.Parameter(torch.zeros(1))
        self.log_var_head2 = nn.Parameter(torch.zeros(1))

    def forward(
        self,
        smile_pred: torch.Tensor,
        emotion_pred: torch.Tensor,
        smile_target: torch.Tensor,
        emotion_target: torch.Tensor,
        head1_mask: torch.Tensor,
        head2_mask: torch.Tensor
    ):
        """순전파 (적응형 가중치 적용)"""
        # 기본 Loss 계산
        losses = super().forward(
            smile_pred, emotion_pred,
            smile_target, emotion_target,
            head1_mask, head2_mask
        )

        # 불확실성 기반 가중치 계산
        # Loss_weighted = Loss / (2 * σ²) + log(σ²)
        precision_head1 = torch.exp(-self.log_var_head1)
        precision_head2 = torch.exp(-self.log_var_head2)

        weighted_head1 = precision_head1 * losses['head1_masked_loss'] + self.log_var_head1
        weighted_head2 = precision_head2 * losses['head2_masked_loss'] + self.log_var_head2

        total_loss = weighted_head1 + weighted_head2

        losses['total_loss'] = total_loss
        losses['head1_weight'] = precision_head1.item()
        losses['head2_weight'] = precision_head2.item()

        return losses


class FocalLoss(nn.Module):
    """
    Focal Loss for Classification

    클래스 불균형 문제 완화 (어려운 샘플에 집중)

    Args:
        gamma: Focusing parameter (기본값 2.0)
        alpha: 클래스별 가중치 (옵션)
    """

    def __init__(self, gamma: float = 2.0, alpha: torch.Tensor = None):
        super(FocalLoss, self).__init__()
        self.gamma = gamma
        self.alpha = alpha

    def forward(self, inputs: torch.Tensor, targets: torch.Tensor):
        """
        Args:
            inputs: 예측 로짓 (B, num_classes)
            targets: 타겟 라벨 (B,)
        """
        ce_loss = F.cross_entropy(inputs, targets, reduction='none')
        pt = torch.exp(-ce_loss)  # 예측 확률
        focal_loss = (1 - pt) ** self.gamma * ce_loss

        if self.alpha is not None:
            alpha_t = self.alpha[targets]
            focal_loss = alpha_t * focal_loss

        return focal_loss.mean()


def build_loss_function(config: dict, adaptive: bool = False):
    """
    Loss Function 생성 (편의 함수)

    Args:
        config: 학습 설정 딕셔너리
        adaptive: 적응형 Multi-task Loss 사용 여부

    Returns:
        Loss function (MultiTaskLoss 또는 AdaptiveMultiTaskLoss)
    """
    loss_config = config.get('training', {}).get('loss', {})

    head1_weight = loss_config.get('head1_weight', 1.0)
    head2_weight = loss_config.get('head2_weight', 1.0)
    focal_loss = loss_config.get('focal_loss', False)
    focal_gamma = loss_config.get('focal_gamma', 2.0)
    label_smoothing = loss_config.get('label_smoothing', 0.0)

    if adaptive:
        return AdaptiveMultiTaskLoss(
            focal_loss=focal_loss,
            focal_gamma=focal_gamma,
            label_smoothing=label_smoothing
        )
    else:
        return MultiTaskLoss(
            head1_weight=head1_weight,
            head2_weight=head2_weight,
            focal_loss=focal_loss,
            focal_gamma=focal_gamma,
            label_smoothing=label_smoothing
        )
