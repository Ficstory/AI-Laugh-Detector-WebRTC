"""
FER2013 Dataset Loader
표정 분류 전용 데이터셋 (Head 2 학습용)
"""
import torch
from torch.utils.data import Dataset
from pathlib import Path
from PIL import Image
import albumentations as A
from albumentations.pytorch import ToTensorV2
import cv2
import numpy as np


# FER2013 클래스 매핑
EMOTION_LABELS = {
    'angry': 0,
    'disgust': 1,
    'fear': 2,
    'happy': 3,
    'neutral': 4,
    'sad': 5,
    'surprise': 6
}

EMOTION_NAMES = {
    0: '분노 (Anger)',
    1: '혐오 (Disgust)',
    2: '공포 (Fear)',
    3: '행복 (Happiness)',
    4: '중립 (Neutral)',
    5: '슬픔 (Sadness)',
    6: '놀람 (Surprise)'
}


class FER2013Dataset(Dataset):
    """
    FER2013 데이터셋

    구조:
        data/raw/fer2013/
        ├── train/
        │   ├── angry/
        │   ├── disgust/
        │   ├── fear/
        │   ├── happy/
        │   ├── neutral/
        │   ├── sad/
        │   └── surprise/
        └── test/
            └── (same structure)

    Returns:
        - image: (3, 224, 224) 텐서
        - smile_label: -1.0 (없음, Masked Loss용)
        - emotion_label: 0~6 (감정 클래스)
        - head1_mask: 0.0 (Head 1 Loss 무시)
        - head2_mask: 1.0 (Head 2 Loss 계산)
        - dataset_name: "fer2013"
    """

    def __init__(
        self,
        root_dir: str,
        split: str = 'train',
        transform=None,
        image_size: tuple = (224, 224)
    ):
        """
        Args:
            root_dir: FER2013 루트 디렉토리
            split: 'train' or 'test'
            transform: Albumentations transform (옵션)
            image_size: 이미지 크기 (H, W)
        """
        self.root_dir = Path(root_dir)
        self.split = split
        self.image_size = image_size

        # 기본 transform
        if transform is None:
            self.transform = A.Compose([
                A.Resize(image_size[0], image_size[1]),
                # FER2013은 그레이스케일이므로 RGB로 변환 필요
                A.ToGray(p=0.0),  # 이미 그레이스케일이지만 확인용
                A.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                ),
                ToTensorV2()
            ])
        else:
            self.transform = transform

        # 이미지 경로 및 라벨 수집
        self.samples = []
        self._load_samples()

    def _load_samples(self):
        """이미지 경로 및 라벨 수집"""
        split_dir = self.root_dir / self.split

        if not split_dir.exists():
            raise ValueError(f"Split directory not found: {split_dir}")

        emotion_counts = {name: 0 for name in EMOTION_LABELS.keys()}

        for emotion_name, emotion_idx in EMOTION_LABELS.items():
            emotion_dir = split_dir / emotion_name

            if not emotion_dir.exists():
                print(f"⚠ Warning: {emotion_name} directory not found")
                continue

            images = list(emotion_dir.glob("*.jpg")) + list(emotion_dir.glob("*.png"))

            for img_path in images:
                self.samples.append({
                    'image_path': img_path,
                    'smile_label': -1.0,  # 없음
                    'emotion_label': emotion_idx,
                    'emotion_name': emotion_name
                })
                emotion_counts[emotion_name] += 1

        print(f"✓ FER2013 ({self.split}): {len(self.samples)} images loaded")
        for emotion_name, count in emotion_counts.items():
            print(f"  - {emotion_name:10s}: {count:5d}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        """
        Returns:
            dict: {
                'image': (3, H, W) tensor,
                'smile_label': float (-1.0),
                'emotion_label': int (0~6),
                'head1_mask': float (0.0),
                'head2_mask': float (1.0),
                'dataset_name': str ("fer2013"),
                'image_path': str
            }
        """
        sample = self.samples[idx]

        # 이미지 로드
        image = cv2.imread(str(sample['image_path']))

        # FER2013은 그레이스케일이므로 RGB로 변환
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        else:
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Transform 적용
        if self.transform:
            transformed = self.transform(image=image)
            image = transformed['image']

        return {
            'image': image,
            'smile_label': sample['smile_label'],
            'emotion_label': sample['emotion_label'],
            'head1_mask': 0.0,  # Head 1 Loss 무시
            'head2_mask': 1.0,  # Head 2 Loss 계산
            'dataset_name': 'fer2013',
            'image_path': str(sample['image_path'])
        }


def get_fer2013_transforms(image_size=(224, 224), augment=True):
    """
    FER2013용 Transform 생성

    Args:
        image_size: 이미지 크기
        augment: 데이터 증강 사용 여부

    Returns:
        Albumentations transform
    """
    if augment:
        return A.Compose([
            A.Resize(image_size[0], image_size[1]),
            A.HorizontalFlip(p=0.5),
            A.Rotate(limit=10, p=0.3),
            A.ColorJitter(
                brightness=0.15,
                contrast=0.15,
                saturation=0.15,
                hue=0.05,
                p=0.3
            ),
            A.GaussNoise(var_limit=(5.0, 30.0), p=0.2),
            A.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
            ToTensorV2()
        ])
    else:
        return A.Compose([
            A.Resize(image_size[0], image_size[1]),
            A.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
            ToTensorV2()
        ])
