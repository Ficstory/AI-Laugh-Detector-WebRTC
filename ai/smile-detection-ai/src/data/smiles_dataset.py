"""
SMILES Dataset Loader
웃음 감지 보조 데이터셋 (Head 1 학습용)
"""
import torch
from torch.utils.data import Dataset
from pathlib import Path
from PIL import Image
import albumentations as A
from albumentations.pytorch import ToTensorV2
import cv2
import numpy as np


class SMILESDataset(Dataset):
    """
    SMILES 데이터셋

    구조:
        data/raw/smiles/
        ├── Dataset for Smile Detection from Face Images/
        │   └── Dataset for Smile Detection from Face Images/
        │       ├── SMILE_list.txt
        │       └── NON-SMILE_list.txt
        └── lfwcrop_color/
            └── lfwcrop_color/
                └── faces/
                    ├── Aaron_Eckhart_0001.ppm
                    └── ...

    Returns:
        - image: (3, 224, 224) 텐서
        - smile_label: 0.0 (non-smile) or 1.0 (smile)
        - emotion_label: -1 (없음, Masked Loss용)
        - head1_mask: 1.0 (Head 1 Loss 계산)
        - head2_mask: 0.0 (Head 2 Loss 무시)
        - dataset_name: "smiles"
    """

    def __init__(
        self,
        root_dir: str,
        transform=None,
        image_size: tuple = (224, 224)
    ):
        """
        Args:
            root_dir: SMILES 루트 디렉토리
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
        label_dir = self.root_dir / "Dataset for Smile Detection from Face Images" / "Dataset for Smile Detection from Face Images"
        images_dir = self.root_dir / "lfwcrop_color" / "lfwcrop_color" / "faces"

        if not label_dir.exists():
            raise ValueError(f"Label directory not found: {label_dir}")

        if not images_dir.exists():
            raise ValueError(f"Images directory not found: {images_dir}")

        # SMILE 라벨 로드
        smile_file = label_dir / "SMILE_list.txt"
        nonsmile_file = label_dir / "NON-SMILE_list.txt"

        smile_count = 0
        nonsmile_count = 0

        # Smile 이미지
        if smile_file.exists():
            with open(smile_file, 'r') as f:
                for line in f:
                    filename = line.strip()
                    if not filename:
                        continue

                    # .jpg를 .ppm으로 변경
                    ppm_filename = filename.replace('.jpg', '.ppm')
                    img_path = images_dir / ppm_filename

                    if img_path.exists():
                        self.samples.append({
                            'image_path': img_path,
                            'smile_label': 1.0,
                            'emotion_label': -1
                        })
                        smile_count += 1

        # Non-smile 이미지
        if nonsmile_file.exists():
            with open(nonsmile_file, 'r') as f:
                for line in f:
                    filename = line.strip()
                    if not filename:
                        continue

                    # .jpg를 .ppm으로 변경
                    ppm_filename = filename.replace('.jpg', '.ppm')
                    img_path = images_dir / ppm_filename

                    if img_path.exists():
                        self.samples.append({
                            'image_path': img_path,
                            'smile_label': 0.0,
                            'emotion_label': -1
                        })
                        nonsmile_count += 1

        print(f"✓ SMILES: {len(self.samples)} images loaded")
        print(f"  - Smile: {smile_count}")
        print(f"  - Non-smile: {nonsmile_count}")

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
                'dataset_name': str ("smiles"),
                'image_path': str
            }
        """
        sample = self.samples[idx]

        # 이미지 로드 (.ppm 형식)
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
            'dataset_name': 'smiles',
            'image_path': str(sample['image_path'])
        }


def get_smiles_transforms(image_size=(224, 224), augment=True):
    """
    SMILES용 Transform 생성

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
