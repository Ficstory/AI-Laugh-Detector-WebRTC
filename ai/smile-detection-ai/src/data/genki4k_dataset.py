"""
GENKI-4K Dataset Loader
웃음 감지 전용 데이터셋 (Head 1 학습용)
"""
import torch
from torch.utils.data import Dataset
from pathlib import Path
from PIL import Image
import albumentations as A
from albumentations.pytorch import ToTensorV2
import cv2
import numpy as np


class GENKI4KDataset(Dataset):
    """
    GENKI-4K 데이터셋

    구조:
        data/raw/genki4k/kaggle-genki4k/
        ├── smile/       # 2,162 images
        └── non_smile/   # 1,838 images

    Returns:
        - image: (3, 224, 224) 텐서
        - smile_label: 0.0 (non-smile) or 1.0 (smile)
        - emotion_label: -1 (없음, Masked Loss용)
        - head1_mask: 1.0 (Head 1 Loss 계산)
        - head2_mask: 0.0 (Head 2 Loss 무시)
        - dataset_name: "genki4k"
    """

    def __init__(
        self,
        root_dir: str,
        transform=None,
        image_size: tuple = (224, 224)
    ):
        """
        Args:
            root_dir: GENKI-4K 루트 디렉토리
            transform: Albumentations transform (옵션)
            image_size: 이미지 크기 (H, W)
        """
        self.root_dir = Path(root_dir)
        self.image_size = image_size

        # 기본 transform
        if transform is None:
            self.transform = A.Compose([
                A.Resize(image_size[0], image_size[1]),
                A.Normalize(
                    mean=[0.485, 0.456, 0.406],  # ImageNet 평균
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
        # Smile 이미지
        smile_dir = self.root_dir / "kaggle-genki4k" / "smile"
        if smile_dir.exists():
            smile_images = list(smile_dir.glob("*.jpg"))
            for img_path in smile_images:
                self.samples.append({
                    'image_path': img_path,
                    'smile_label': 1.0,  # Smiling
                    'emotion_label': -1,  # 없음
                })

        # Non-smile 이미지
        nonsmile_dir = self.root_dir / "kaggle-genki4k" / "non_smile"
        if nonsmile_dir.exists():
            nonsmile_images = list(nonsmile_dir.glob("*.jpg"))
            for img_path in nonsmile_images:
                self.samples.append({
                    'image_path': img_path,
                    'smile_label': 0.0,  # Not smiling
                    'emotion_label': -1,  # 없음
                })

        print(f"✓ GENKI-4K: {len(self.samples)} images loaded")
        print(f"  - Smile: {sum(1 for s in self.samples if s['smile_label'] == 1.0)}")
        print(f"  - Non-smile: {sum(1 for s in self.samples if s['smile_label'] == 0.0)}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        """
        Returns:
            dict: {
                'image': (3, H, W) tensor,
                'smile_label': float (0.0 or 1.0),
                'emotion_label': int (-1),
                'head1_mask': float (1.0),
                'head2_mask': float (0.0),
                'dataset_name': str ("genki4k"),
                'image_path': str
            }
        """
        sample = self.samples[idx]

        # 이미지 로드
        image = cv2.imread(str(sample['image_path']))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Transform 적용
        if self.transform:
            transformed = self.transform(image=image)
            image = transformed['image']

        return {
            'image': image,
            'smile_label': sample['smile_label'],
            'emotion_label': sample['emotion_label'],
            'head1_mask': 1.0,  # Head 1 Loss 계산
            'head2_mask': 0.0,  # Head 2 Loss 무시
            'dataset_name': 'genki4k',
            'image_path': str(sample['image_path'])
        }


def get_genki4k_transforms(image_size=(224, 224), augment=True):
    """
    GENKI-4K용 Transform 생성

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
            A.Rotate(limit=15, p=0.5),
            A.ColorJitter(
                brightness=0.2,
                contrast=0.2,
                saturation=0.2,
                hue=0.1,
                p=0.5
            ),
            A.GaussNoise(var_limit=(10.0, 50.0), p=0.3),
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
