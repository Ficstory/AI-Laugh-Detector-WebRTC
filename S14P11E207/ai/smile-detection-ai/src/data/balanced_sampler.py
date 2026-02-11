"""
Balanced Sampler for Multi-Dataset
데이터셋 간 균형을 맞추는 Sampler
"""
import torch
from torch.utils.data import Sampler, DataLoader
import random
from collections import defaultdict


class BalancedMultiDatasetSampler(Sampler):
    """
    여러 데이터셋을 균형있게 샘플링하는 Sampler

    전략:
    - 각 데이터셋을 50:50 비율로 섞음
    - GENKI+SMILES (Head 1) vs FER2013 (Head 2)
    - 배치당 Head 1과 Head 2가 거의 동일하게 학습

    Example:
        Batch size = 32
        → Head 1 데이터: 16개
        → Head 2 데이터: 16개
        → Mask 평균: 0.5 : 0.5
    """

    def __init__(
        self,
        datasets,
        samples_per_epoch=None,
        ratio=0.5
    ):
        """
        Args:
            datasets: List of datasets [genki, fer, smiles]
            samples_per_epoch: Epoch당 총 샘플 수 (None이면 자동 계산)
            ratio: Head 1 데이터 비율 (기본 0.5 = 50:50)
        """
        self.datasets = datasets
        self.ratio = ratio

        # 데이터셋별 인덱스 분류
        self.dataset_indices = defaultdict(list)
        current_idx = 0

        for dataset in datasets:
            dataset_size = len(dataset)
            first_sample = dataset[0]
            dataset_name = first_sample.get('dataset_name', 'unknown')

            # Head 1 (Smile) vs Head 2 (Emotion) 분류
            head1_mask = first_sample.get('head1_mask', 0.0)

            if head1_mask > 0.5:
                group = 'head1'  # GENKI, SMILES
            else:
                group = 'head2'  # FER2013

            for i in range(dataset_size):
                self.dataset_indices[group].append(current_idx + i)

            current_idx += dataset_size

        self.head1_indices = self.dataset_indices['head1']
        self.head2_indices = self.dataset_indices['head2']

        print(f"\n[Balanced Sampler]")
        print(f"  Head 1 (Smile):   {len(self.head1_indices):,} samples")
        print(f"  Head 2 (Emotion): {len(self.head2_indices):,} samples")
        print(f"  Ratio: {ratio:.0%} Head 1, {1-ratio:.0%} Head 2")

        # Epoch당 샘플 수 계산
        if samples_per_epoch is None:
            # 더 많은 쪽을 기준으로 설정
            max_samples = max(len(self.head1_indices), len(self.head2_indices))
            self.samples_per_epoch = max_samples * 2  # 양쪽 합쳐서
        else:
            self.samples_per_epoch = samples_per_epoch

        print(f"  Samples per epoch: {self.samples_per_epoch:,}")

    def __iter__(self):
        """
        균형잡힌 인덱스 생성

        전략:
        1. Head 1 인덱스를 셔플하고 반복
        2. Head 2 인덱스를 셔플하고 반복
        3. ratio에 따라 섞어서 반환
        """
        # 인덱스 셔플 및 반복 준비
        head1_shuffled = self.head1_indices.copy()
        head2_shuffled = self.head2_indices.copy()
        random.shuffle(head1_shuffled)
        random.shuffle(head2_shuffled)

        # 충분한 샘플 확보 (반복)
        num_head1 = int(self.samples_per_epoch * self.ratio)
        num_head2 = self.samples_per_epoch - num_head1

        # Head 1 인덱스 (반복해서 필요한 만큼)
        head1_samples = []
        while len(head1_samples) < num_head1:
            head1_samples.extend(head1_shuffled)
        head1_samples = head1_samples[:num_head1]

        # Head 2 인덱스 (반복해서 필요한 만큼)
        head2_samples = []
        while len(head2_samples) < num_head2:
            head2_samples.extend(head2_shuffled)
        head2_samples = head2_samples[:num_head2]

        # 합쳐서 셔플
        all_indices = head1_samples + head2_samples
        random.shuffle(all_indices)

        return iter(all_indices)

    def __len__(self):
        return self.samples_per_epoch


def create_balanced_dataloader(
    genki4k_dataset,
    fer2013_dataset,
    smiles_dataset=None,
    batch_size=32,
    ratio=0.5,
    num_workers=4,
    pin_memory=True
):
    """
    균형잡힌 Multi-Dataset DataLoader 생성

    Args:
        genki4k_dataset: GENKI-4K 데이터셋
        fer2013_dataset: FER2013 데이터셋
        smiles_dataset: SMILES 데이터셋 (옵션)
        batch_size: 배치 크기
        ratio: Head 1 비율 (0.5 = 50:50)
        num_workers: 워커 수
        pin_memory: GPU 메모리 고정

    Returns:
        DataLoader
    """
    from .multi_dataset import MultiDataset, collate_fn_multi

    datasets = [genki4k_dataset, fer2013_dataset]
    if smiles_dataset is not None:
        datasets.append(smiles_dataset)

    print("\n" + "=" * 60)
    print("Balanced Multi-Dataset Loader 생성")
    print("=" * 60)

    multi_dataset = MultiDataset(datasets)

    # Balanced Sampler 생성
    sampler = BalancedMultiDatasetSampler(
        datasets=datasets,
        samples_per_epoch=None,  # 자동 계산
        ratio=ratio
    )

    dataloader = DataLoader(
        multi_dataset,
        batch_size=batch_size,
        sampler=sampler,  # shuffle 대신 sampler 사용
        num_workers=num_workers,
        pin_memory=pin_memory,
        drop_last=False,
        collate_fn=collate_fn_multi
    )

    print(f"✓ Batch size: {batch_size}")
    print(f"✓ Total batches: {len(dataloader):,}")
    print("=" * 60)

    return dataloader
