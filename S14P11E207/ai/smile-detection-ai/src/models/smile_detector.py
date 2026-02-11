"""
웃음 감지 모델
MobileNetV3 (CNN) + LSTM Hybrid 아키텍처
"""
import torch
import torch.nn as nn
from torchvision import models


class SmileDetector(nn.Module):
    """
    웃음 감지 모델 (CNN + LSTM)

    Architecture:
        1. CNN Backbone (MobileNetV3-Small) - 공간적 특징 추출
        2. LSTM - 시간적 패턴 학습
        3. FC Classifier - 이진 분류 (웃음/비웃음)
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
                - classifier.hidden_units: FC 레이어 은닉 유닛 리스트
                - classifier.dropout: FC dropout 비율
        """
        super(SmileDetector, self).__init__()

        self.config = config

        # 1. CNN Backbone
        self.backbone = self._build_backbone()

        # 2. LSTM
        self.lstm = self._build_lstm()

        # 3. Classifier
        self.classifier = self._build_classifier()

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

    def _build_classifier(self) -> nn.Module:
        """분류기 구축"""
        lstm_hidden_size = self.config.get('lstm', {}).get('hidden_size', 128)
        bidirectional = self.config.get('lstm', {}).get('bidirectional', True)
        lstm_output_dim = lstm_hidden_size * 2 if bidirectional else lstm_hidden_size

        hidden_units = self.config.get('classifier', {}).get('hidden_units', [64])
        classifier_dropout = self.config.get('classifier', {}).get('dropout', 0.5)

        layers = []
        input_dim = lstm_output_dim

        # 은닉 레이어
        for hidden_dim in hidden_units:
            layers.extend([
                nn.Linear(input_dim, hidden_dim),
                nn.ReLU(inplace=True),
                nn.Dropout(classifier_dropout)
            ])
            input_dim = hidden_dim

        # 출력 레이어 (이진 분류)
        layers.append(nn.Linear(input_dim, 1))
        layers.append(nn.Sigmoid())

        return nn.Sequential(*layers)

    def forward(self, x):
        """
        순전파

        Args:
            x: 입력 텐서 (batch_size, sequence_length, channels, height, width)

        Returns:
            웃음 확률 (batch_size, 1)
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
        last_output = lstm_out[:, -1, :]  # (B, hidden*2)

        # 분류
        output = self.classifier(last_output)  # (B, 1)

        return output

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
                'trainable': 학습 가능한 파라미터 수
            }
        """
        total_params = sum(p.numel() for p in self.parameters())
        trainable_params = sum(p.numel() for p in self.parameters() if p.requires_grad)

        return {
            'total': total_params,
            'trainable': trainable_params
        }


def build_model(config: dict) -> SmileDetector:
    """
    모델 생성 (편의 함수)

    Args:
        config: 모델 설정 딕셔너리

    Returns:
        SmileDetector 모델
    """
    model = SmileDetector(config)
    return model
