"""
Multi-Dataset Loader
여러 데이터셋을 합쳐서 사용 (Masked Loss용)
"""
import torch
from torch.utils.data import Dataset, ConcatDataset, DataLoader
import random


class MultiDataset(ConcatDataset):
    """
    여러 데이터셋을 합친 Dataset

    Masked Loss 전략:
    - GENKI-4K, SMILES → head1_mask=1.0, head2_mask=0.0
    - FER2013 → head1_mask=0.0, head2_mask=1.0
    """

    def __init__(self, datasets):
        """
        Args:
            datasets: List of datasets
        """
        super().__init__(datasets)
        self.datasets = datasets

        # 데이터셋별 통계
        total_samples = 0
        for dataset in datasets:
            # 첫 샘플을 가져와서 dataset_name 확인
            if len(dataset) > 0:
                first_sample = dataset[0]
                dataset_name = first_sample.get('dataset_name', 'unknown')
            else:
                dataset_name = 'unknown'

            count = len(dataset)
            total_samples += count
            print(f"  - {dataset_name}: {count:,} samples")

        print(f"✓ Multi-Dataset: {total_samples:,} total samples")


def create_multi_dataloader(
    genki4k_dataset,
    fer2013_dataset,
    smiles_dataset=None,
    batch_size=32,
    shuffle=True,
    num_workers=4,
    pin_memory=True
):
    """
    Multi-Dataset DataLoader 생성

    Args:
        genki4k_dataset: GENKI-4K 데이터셋
        fer2013_dataset: FER2013 데이터셋
        smiles_dataset: SMILES 데이터셋 (옵션)
        batch_size: 배치 크기
        shuffle: 셔플 여부
        num_workers: 워커 수
        pin_memory: GPU 메모리 고정

    Returns:
        DataLoader
    """
    datasets = [genki4k_dataset, fer2013_dataset]

    if smiles_dataset is not None:
        datasets.append(smiles_dataset)

    print("\n" + "=" * 60)
    print("Multi-Dataset Loader 생성")
    print("=" * 60)

    multi_dataset = MultiDataset(datasets)

    dataloader = DataLoader(
        multi_dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=pin_memory,
        drop_last=False,
        collate_fn=collate_fn_multi
    )

    print(f"✓ Batch size: {batch_size}")
    print(f"✓ Total batches: {len(dataloader):,}")
    print("=" * 60)

    return dataloader


def collate_fn_multi(batch):
    """
    Multi-Dataset을 위한 Collate Function

    배치 내 샘플들을 텐서로 변환

    Args:
        batch: List of samples

    Returns:
        dict: {
            'images': (B, 3, H, W),
            'smile_labels': (B, 1),
            'emotion_labels': (B,),
            'head1_masks': (B,),
            'head2_masks': (B,),
            'dataset_names': List[str],
            'image_paths': List[str]
        }
    """
    images = []
    smile_labels = []
    emotion_labels = []
    head1_masks = []
    head2_masks = []
    dataset_names = []
    image_paths = []

    for sample in batch:
        images.append(sample['image'])

        # smile_label이 -1이면 0으로 변환 (Masked Loss에서 무시됨)
        smile_label = sample['smile_label']
        if smile_label == -1:
            smile_label = 0.0  # Dummy value (mask=0으로 무시됨)
        smile_labels.append(smile_label)

        # emotion_label이 -1이면 0으로 변환 (Masked Loss에서 무시됨)
        emotion_label = sample['emotion_label']
        if emotion_label == -1:
            emotion_label = 0  # Dummy value (mask=0으로 무시됨)

        emotion_labels.append(emotion_label)
        head1_masks.append(sample['head1_mask'])
        head2_masks.append(sample['head2_mask'])
        dataset_names.append(sample['dataset_name'])
        image_paths.append(sample['image_path'])

    # 이미지를 스택하고 sequence 차원 추가
    # (B, C, H, W) → (B, 1, C, H, W)
    images_tensor = torch.stack(images).unsqueeze(1)

    return {
        'images': images_tensor,  # (B, 1, C, H, W)
        'smile_labels': torch.tensor(smile_labels, dtype=torch.float32).unsqueeze(1),
        'emotion_labels': torch.tensor(emotion_labels, dtype=torch.long),
        'head1_masks': torch.tensor(head1_masks, dtype=torch.float32),
        'head2_masks': torch.tensor(head2_masks, dtype=torch.float32),
        'dataset_names': dataset_names,
        'image_paths': image_paths
    }
