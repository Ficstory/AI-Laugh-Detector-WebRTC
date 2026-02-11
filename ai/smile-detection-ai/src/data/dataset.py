"""
웃음 감지 데이터셋
비디오 시퀀스 데이터 로딩 및 전처리
"""
import torch
from torch.utils.data import Dataset
import cv2
import numpy as np
from pathlib import Path
from typing import Tuple, Optional
import albumentations as A
from albumentations.pytorch import ToTensorV2


class SmileVideoDataset(Dataset):
    """
    비디오 시퀀스 데이터셋

    데이터 구조:
        data/
        ├── processed/
        │   ├── train/
        │   │   ├── smile/
        │   │   │   ├── video_001/
        │   │   │   │   ├── frame_0000.jpg
        │   │   │   │   ├── frame_0001.jpg
        │   │   │   │   └── ...
        │   │   └── no_smile/
        │   ├── val/
        │   └── test/
    """

    def __init__(
        self,
        data_dir: str,
        split: str = 'train',
        sequence_length: int = 10,
        image_size: Tuple[int, int] = (224, 224),
        augmentation: bool = True
    ):
        """
        Args:
            data_dir: 데이터 루트 디렉토리
            split: 'train', 'val', 'test'
            sequence_length: 입력 시퀀스 길이 (프레임 수)
            image_size: 이미지 크기 (H, W)
            augmentation: 데이터 증강 사용 여부
        """
        self.data_dir = Path(data_dir)
        self.split = split
        self.sequence_length = sequence_length
        self.image_size = image_size
        self.augmentation = augmentation and split == 'train'

        # 데이터 로드
        self.samples = self._load_samples()

        # 전처리 파이프라인
        self.transform = self._get_transforms()

    def _load_samples(self) -> list:
        """
        데이터 샘플 로드

        Returns:
            [(video_path, label), ...] 리스트
        """
        samples = []
        split_dir = self.data_dir / self.split

        if not split_dir.exists():
            raise FileNotFoundError(f"데이터 디렉토리를 찾을 수 없습니다: {split_dir}")

        # smile (label=1)
        smile_dir = split_dir / 'smile'
        if smile_dir.exists():
            for video_dir in smile_dir.iterdir():
                if video_dir.is_dir():
                    samples.append((video_dir, 1))

        # no_smile (label=0)
        no_smile_dir = split_dir / 'no_smile'
        if no_smile_dir.exists():
            for video_dir in no_smile_dir.iterdir():
                if video_dir.is_dir():
                    samples.append((video_dir, 0))

        if len(samples) == 0:
            raise ValueError(f"샘플을 찾을 수 없습니다: {split_dir}")

        return samples

    def _get_transforms(self):
        """데이터 증강 및 전처리 파이프라인"""
        if self.augmentation:
            # 학습용: 데이터 증강
            return A.Compose([
                A.Resize(self.image_size[0], self.image_size[1]),
                A.HorizontalFlip(p=0.5),
                A.Rotate(limit=15, p=0.5),
                A.RandomBrightnessContrast(
                    brightness_limit=0.2,
                    contrast_limit=0.2,
                    p=0.5
                ),
                A.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                ),
                ToTensorV2()
            ])
        else:
            # 검증/테스트용: 증강 없음
            return A.Compose([
                A.Resize(self.image_size[0], self.image_size[1]),
                A.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                ),
                ToTensorV2()
            ])

    def _load_frames(self, video_dir: Path) -> list:
        """
        비디오 디렉토리에서 프레임 로드

        Args:
            video_dir: 프레임이 저장된 디렉토리

        Returns:
            프레임 리스트 (정렬됨)
        """
        frames = sorted(list(video_dir.glob('*.jpg')) + list(video_dir.glob('*.png')))
        return frames

    def _sample_frames(self, frames: list) -> list:
        """
        시퀀스 길이에 맞게 프레임 샘플링

        Args:
            frames: 전체 프레임 리스트

        Returns:
            샘플링된 프레임 리스트
        """
        total_frames = len(frames)

        if total_frames < self.sequence_length:
            # 프레임이 부족하면 반복
            indices = np.random.choice(total_frames, self.sequence_length, replace=True)
        else:
            # 균등하게 샘플링
            indices = np.linspace(0, total_frames - 1, self.sequence_length, dtype=int)

        return [frames[i] for i in indices]

    def __len__(self) -> int:
        """데이터셋 크기"""
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        데이터 샘플 반환

        Args:
            idx: 샘플 인덱스

        Returns:
            (frames, label)
            - frames: (T, C, H, W) 텐서
            - label: (1,) 텐서
        """
        video_dir, label = self.samples[idx]

        # 프레임 로드 및 샘플링
        all_frames = self._load_frames(video_dir)
        sampled_frames = self._sample_frames(all_frames)

        # 프레임 전처리
        frames_tensor = []
        for frame_path in sampled_frames:
            # 이미지 로드
            image = cv2.imread(str(frame_path))
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # 증강 및 정규화
            transformed = self.transform(image=image)
            frame_tensor = transformed['image']

            frames_tensor.append(frame_tensor)

        # (T, C, H, W)
        frames_tensor = torch.stack(frames_tensor)

        # 레이블
        label_tensor = torch.tensor([label], dtype=torch.float32)

        return frames_tensor, label_tensor


class SimpleImageDataset(Dataset):
    """
    단순 이미지 데이터셋 (시퀀스 없이)
    초기 테스트용
    """

    def __init__(
        self,
        data_dir: str,
        split: str = 'train',
        image_size: Tuple[int, int] = (224, 224),
        augmentation: bool = True
    ):
        """
        Args:
            data_dir: 데이터 루트 디렉토리
            split: 'train', 'val', 'test'
            image_size: 이미지 크기 (H, W)
            augmentation: 데이터 증강 사용 여부
        """
        self.data_dir = Path(data_dir)
        self.split = split
        self.image_size = image_size
        self.augmentation = augmentation and split == 'train'

        self.samples = self._load_samples()
        self.transform = self._get_transforms()

    def _load_samples(self) -> list:
        """이미지 파일 로드"""
        samples = []
        split_dir = self.data_dir / self.split

        if not split_dir.exists():
            raise FileNotFoundError(f"데이터 디렉토리를 찾을 수 없습니다: {split_dir}")

        # smile (label=1)
        smile_dir = split_dir / 'smile'
        if smile_dir.exists():
            for img_path in smile_dir.glob('*.jpg'):
                samples.append((img_path, 1))
            for img_path in smile_dir.glob('*.png'):
                samples.append((img_path, 1))

        # no_smile (label=0)
        no_smile_dir = split_dir / 'no_smile'
        if no_smile_dir.exists():
            for img_path in no_smile_dir.glob('*.jpg'):
                samples.append((img_path, 0))
            for img_path in no_smile_dir.glob('*.png'):
                samples.append((img_path, 0))

        if len(samples) == 0:
            raise ValueError(f"샘플을 찾을 수 없습니다: {split_dir}")

        return samples

    def _get_transforms(self):
        """데이터 증강 및 전처리 파이프라인"""
        if self.augmentation:
            return A.Compose([
                A.Resize(self.image_size[0], self.image_size[1]),
                A.HorizontalFlip(p=0.5),
                A.Rotate(limit=15, p=0.5),
                A.RandomBrightnessContrast(p=0.5),
                A.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                ),
                ToTensorV2()
            ])
        else:
            return A.Compose([
                A.Resize(self.image_size[0], self.image_size[1]),
                A.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                ),
                ToTensorV2()
            ])

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        img_path, label = self.samples[idx]

        # 이미지 로드
        image = cv2.imread(str(img_path))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # 전처리
        transformed = self.transform(image=image)
        image_tensor = transformed['image']

        label_tensor = torch.tensor([label], dtype=torch.float32)

        return image_tensor, label_tensor
