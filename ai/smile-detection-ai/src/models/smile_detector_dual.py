"""
웃음 감지 + 표정 분류 Dual-Head 모델
MobileNetV3 (CNN) + LSTM + Dual-Head 아키텍처
"""
import torch
import torch.nn as nn
from torchvision import models


class DualHeadSmileDetector(nn.Module):
    """
    Dual-Head 웃음 감지 + 표정 분류 모델

    Architecture:
        1. CNN Backbone (MobileNetV3-Small) - 공간적 특징 추출
        2. LSTM - 시간적 패턴 학습
        3. Dual-Head Classifier
           - Head 1: 웃음 감지 (Binary: Smiling/Not-Smiling)
           - Head 2: 표정 분류 (Multi-class: 7-8가지 표정)
    """

    def __init__(self, config: dict):
        """
        Args:
            config: 모델 설정 딕셔너리
                - backbone: 'mobilenet_v3_small' or 'mobilenet_v3_large'
                - pretrained: ImageNet 가중치 사용 여부
                - freeze_backbone: CNN 가중치 고정 여부
                - cnn.output_features: CNN 출력 차원
                - cnn.dropout: CNN dropout 비율
                - lstm.hidden_size: LSTM 은닉 차원
                - lstm.num_layers: LSTM 레이어 수
                - lstm.dropout: LSTM dropout 비율
                - lstm.bidirectional: 양방향 LSTM 사용 여부
                - head1.hidden_units: 웃음 감지 FC 레이어 은닉 유닛
                - head1.dropout: 웃음 감지 dropout
                - head2.num_classes: 표정 클래스 수 (기본 7)
                - head2.hidden_units: 표정 분류 FC 레이어 은닉 유닛
                - head2.dropout: 표정 분류 dropout
        """
        super(DualHeadSmileDetector, self).__init__()

        self.config = config

        # 1. CNN Backbone
        self.backbone = self._build_backbone()

        # 2. LSTM
        self.lstm = self._build_lstm()

        # 3. Dual-Head Classifiers
        self.smile_head = self._build_smile_head()  # Binary: Smiling/Not-Smiling
        self.emotion_head = self._build_emotion_head()  # Multi-class: 7-8 emotions

    def _build_backbone(self) -> nn.Module:
        """CNN Backbone 구축"""
        backbone_name = self.config.get('backbone', 'mobilenet_v3_small')
        pretrained = self.config.get('pretrained', True)
        freeze_backbone = self.config.get('freeze_backbone', False)

        if backbone_name == 'mobilenet_v3_small':
            weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
            backbone = models.mobilenet_v3_small(weights=weights)
            in_features = backbone.classifier[0].in_features
        elif backbone_name == 'mobilenet_v3_large':
            weights = models.MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
            backbone = models.mobilenet_v3_large(weights=weights)
            in_features = backbone.classifier[0].in_features
        else:
            raise ValueError(f"지원하지 않는 백본: {backbone_name}")

        # 분류 레이어 제거하고 특징 추출기만 사용
        backbone.classifier = nn.Identity()

        # Backbone freeze
        if freeze_backbone:
            for param in backbone.parameters():
                param.requires_grad = False

        # CNN 출력 차원 조정
        cnn_output_dim = self.config.get('cnn', {}).get('output_features', 256)
        cnn_dropout = self.config.get('cnn', {}).get('dropout', 0.3)

        # Feature projection layer
        self.feature_projection = nn.Sequential(
            nn.Linear(in_features, cnn_output_dim),
            nn.ReLU(inplace=True),
            nn.Dropout(cnn_dropout)
        )

        return backbone

    def _build_lstm(self) -> nn.Module:
        """LSTM 구축"""
        cnn_output_dim = self.config.get('cnn', {}).get('output_features', 256)
        lstm_hidden_size = self.config.get('lstm', {}).get('hidden_size', 128)
        lstm_num_layers = self.config.get('lstm', {}).get('num_layers', 2)
        lstm_dropout = self.config.get('lstm', {}).get('dropout', 0.2)
        bidirectional = self.config.get('lstm', {}).get('bidirectional', True)

        lstm = nn.LSTM(
            input_size=cnn_output_dim,
            hidden_size=lstm_hidden_size,
            num_layers=lstm_num_layers,
            dropout=lstm_dropout if lstm_num_layers > 1 else 0,
            bidirectional=bidirectional,
            batch_first=True
        )

        return lstm

    def _build_smile_head(self) -> nn.Module:
        """웃음 감지 Head 구축 (Binary Classification)"""
        lstm_hidden_size = self.config.get('lstm', {}).get('hidden_size', 128)
        bidirectional = self.config.get('lstm', {}).get('bidirectional', True)
        lstm_output_dim = lstm_hidden_size * 2 if bidirectional else lstm_hidden_size

        hidden_units = self.config.get('head1', {}).get('hidden_units', [64])
        dropout = self.config.get('head1', {}).get('dropout', 0.5)

        layers = []
        input_dim = lstm_output_dim

        # 은닉 레이어
        for hidden_dim in hidden_units:
            layers.extend([
                nn.Linear(input_dim, hidden_dim),
                nn.ReLU(inplace=True),
                nn.Dropout(dropout)
            ])
            input_dim = hidden_dim

        # 출력 레이어 (Binary: Smiling 확률)
        layers.append(nn.Linear(input_dim, 1))
        layers.append(nn.Sigmoid())

        return nn.Sequential(*layers)

    def _build_emotion_head(self) -> nn.Module:
        """표정 분류 Head 구축 (Multi-class Classification)"""
        lstm_hidden_size = self.config.get('lstm', {}).get('hidden_size', 128)
        bidirectional = self.config.get('lstm', {}).get('bidirectional', True)
        lstm_output_dim = lstm_hidden_size * 2 if bidirectional else lstm_hidden_size

        num_classes = self.config.get('head2', {}).get('num_classes', 7)
        hidden_units = self.config.get('head2', {}).get('hidden_units', [128, 64])
        dropout = self.config.get('head2', {}).get('dropout', 0.5)

        layers = []
        input_dim = lstm_output_dim

        # 은닉 레이어
        for hidden_dim in hidden_units:
            layers.extend([
                nn.Linear(input_dim, hidden_dim),
                nn.ReLU(inplace=True),
                nn.Dropout(dropout)
            ])
            input_dim = hidden_dim

        # 출력 레이어 (Multi-class: 7-8가지 표정)
        layers.append(nn.Linear(input_dim, num_classes))
        # Softmax는 loss function에서 처리 (CrossEntropyLoss)

        return nn.Sequential(*layers)

    def forward(self, x, return_features=False):
        """
        순전파

        Args:
            x: 입력 텐서 (batch_size, sequence_length, channels, height, width)
            return_features: LSTM 특징도 반환할지 여부

        Returns:
            if return_features=False:
                (smile_prob, emotion_logits)
                - smile_prob: 웃음 확률 (batch_size, 1)
                - emotion_logits: 표정 로짓 (batch_size, num_classes)
            if return_features=True:
                (smile_prob, emotion_logits, lstm_features)
        """
        batch_size, seq_len, c, h, w = x.size()

        # CNN: 각 프레임에서 특징 추출
        # (B, T, C, H, W) -> (B*T, C, H, W)
        x = x.view(batch_size * seq_len, c, h, w)

        # CNN Backbone
        cnn_features = self.backbone(x)  # (B*T, in_features)

        # Feature projection
        cnn_features = self.feature_projection(cnn_features)  # (B*T, cnn_output_dim)

        # (B*T, D) -> (B, T, D)
        cnn_features = cnn_features.view(batch_size, seq_len, -1)

        # LSTM: 시간적 패턴 학습
        lstm_out, (h_n, c_n) = self.lstm(cnn_features)  # lstm_out: (B, T, hidden*2)

        # 마지막 타임스텝 출력 사용
        lstm_features = lstm_out[:, -1, :]  # (B, hidden*2)

        # Dual-Head 분류
        smile_prob = self.smile_head(lstm_features)  # (B, 1)
        emotion_logits = self.emotion_head(lstm_features)  # (B, num_classes)

        if return_features:
            return smile_prob, emotion_logits, lstm_features
        else:
            return smile_prob, emotion_logits

    def predict(self, x, emotion_threshold=0.5):
        """
        예측 (추론 모드)

        Args:
            x: 입력 텐서
            emotion_threshold: 표정 예측을 위한 Softmax 임계값 (옵션)

        Returns:
            dict: {
                'smile_prob': float,  # 웃음 확률 (0~1)
                'is_smiling': bool,   # 웃음 여부
                'emotion_probs': list,  # 각 표정 확률 (Softmax)
                'emotion_pred': int,    # 가장 높은 확률의 표정 인덱스
            }
        """
        self.eval()
        with torch.no_grad():
            smile_prob, emotion_logits = self.forward(x)

            # Softmax for emotion probabilities
            emotion_probs = torch.softmax(emotion_logits, dim=1)

            # 결과 반환
            return {
                'smile_prob': smile_prob.squeeze().item(),
                'is_smiling': (smile_prob.squeeze() > emotion_threshold).item(),
                'emotion_probs': emotion_probs.squeeze().tolist(),
                'emotion_pred': emotion_probs.argmax(dim=1).item(),
            }

    def unfreeze_backbone(self):
        """Backbone 가중치 학습 가능하게 설정"""
        for param in self.backbone.parameters():
            param.requires_grad = True

    def freeze_backbone(self):
        """Backbone 가중치 고정"""
        for param in self.backbone.parameters():
            param.requires_grad = False

    def get_num_params(self) -> dict:
        """
        모델 파라미터 수 계산

        Returns:
            dict: {
                'total': 전체 파라미터 수,
                'trainable': 학습 가능한 파라미터 수,
                'backbone': Backbone 파라미터 수,
                'lstm': LSTM 파라미터 수,
                'smile_head': 웃음 감지 Head 파라미터 수,
                'emotion_head': 표정 분류 Head 파라미터 수
            }
        """
        total_params = sum(p.numel() for p in self.parameters())
        trainable_params = sum(p.numel() for p in self.parameters() if p.requires_grad)
        backbone_params = sum(p.numel() for p in self.backbone.parameters())
        lstm_params = sum(p.numel() for p in self.lstm.parameters())
        smile_head_params = sum(p.numel() for p in self.smile_head.parameters())
        emotion_head_params = sum(p.numel() for p in self.emotion_head.parameters())

        return {
            'total': total_params,
            'trainable': trainable_params,
            'backbone': backbone_params,
            'lstm': lstm_params,
            'smile_head': smile_head_params,
            'emotion_head': emotion_head_params
        }


def build_dual_head_model(config: dict) -> DualHeadSmileDetector:
    """
    Dual-Head 모델 생성 (편의 함수)

    Args:
        config: 모델 설정 딕셔너리

    Returns:
        DualHeadSmileDetector 모델
    """
    model = DualHeadSmileDetector(config)
    return model


# Emotion label mapping
EMOTION_LABELS = {
    0: '중립 (Neutral)',
    1: '분노 (Anger)',
    2: '혐오 (Disgust)',
    3: '공포 (Fear)',
    4: '행복 (Happiness)',
    5: '슬픔 (Sadness)',
    6: '놀람 (Surprise)',
    # 7: '경멸 (Contempt)',  # 옵션 (CK+ 데이터셋에만 있음)
}
