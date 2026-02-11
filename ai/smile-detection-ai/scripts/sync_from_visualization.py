"""
Visualization 폴더 기준으로 images와 labels.csv 동기화
- visualization에 남아있는 파일만 유지
- visualization 폴더 위치(smile/non_smile)를 기준으로 라벨 수정
"""

import csv
import os
from pathlib import Path
import shutil


def sync_from_visualization(data_dir: str = None, dry_run: bool = True):
    """
    visualization 폴더를 기준으로 images와 labels.csv 동기화

    Args:
        data_dir: 데이터 디렉토리 경로
        dry_run: True면 실제로 삭제하지 않고 미리보기만 함
    """
    if data_dir is None:
        script_dir = Path(__file__).resolve().parent
        data_dir = script_dir.parent / "data" / "collected"
    else:
        data_dir = Path(data_dir)

    vis_dir = data_dir / "visualizations"
    images_dir = data_dir / "images"
    csv_path = data_dir / "labels.csv"

    # 1. visualization 폴더에서 유효한 sequence_id와 라벨 수집
    valid_sequences = {}  # {sequence_id: label}

    for label in ["smile", "non_smile"]:
        label_dir = vis_dir / label
        if label_dir.exists():
            for file in label_dir.glob("*.jpg"):
                seq_id = file.stem  # 확장자 제거
                valid_sequences[seq_id] = label

    print(f"=== Visualization 폴더 기준 동기화 ===")
    print(f"유효한 시퀀스 수: {len(valid_sequences)}")
    print(f"  - smile: {sum(1 for v in valid_sequences.values() if v == 'smile')}")
    print(f"  - non_smile: {sum(1 for v in valid_sequences.values() if v == 'non_smile')}")

    if not valid_sequences:
        print("Error: visualization 폴더에 유효한 파일이 없습니다!")
        return

    # 2. labels.csv 읽기
    if not csv_path.exists():
        print(f"Error: {csv_path} 파일이 없습니다!")
        return

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    print(f"\n현재 labels.csv 시퀀스 수: {len(rows)}")

    # 3. 유효한 시퀀스만 필터링 + 라벨 수정
    new_rows = []
    removed_sequences = []
    label_changed = []

    for row in rows:
        seq_id = row['sequence_id']
        if seq_id in valid_sequences:
            new_label = valid_sequences[seq_id]
            if row['label'] != new_label:
                label_changed.append((seq_id, row['label'], new_label))
            row['label'] = new_label
            new_rows.append(row)
        else:
            removed_sequences.append(seq_id)

    print(f"\n삭제될 시퀀스 수: {len(removed_sequences)}")
    print(f"라벨 변경될 시퀀스 수: {len(label_changed)}")
    print(f"유지될 시퀀스 수: {len(new_rows)}")

    if label_changed:
        print("\n라벨 변경 목록:")
        for seq_id, old_label, new_label in label_changed[:10]:
            print(f"  {seq_id}: {old_label} → {new_label}")
        if len(label_changed) > 10:
            print(f"  ... 외 {len(label_changed) - 10}개")

    # 4. 삭제할 이미지 파일 목록 생성
    images_to_delete = []
    for seq_id in removed_sequences:
        for i in range(5):
            img_file = images_dir / f"{seq_id}_frame{i}.jpg"
            if img_file.exists():
                images_to_delete.append(img_file)

    print(f"\n삭제될 이미지 파일 수: {len(images_to_delete)}")

    if dry_run:
        print("\n[DRY RUN] 실제로 삭제하지 않았습니다.")
        print("실제 적용하려면 --apply 옵션을 사용하세요:")
        print("  python sync_from_visualization.py --apply")
        return

    # 5. 실제 적용
    print("\n적용 중...")

    # labels.csv 백업 후 덮어쓰기
    backup_path = csv_path.with_suffix('.csv.backup')
    shutil.copy(csv_path, backup_path)
    print(f"백업 생성: {backup_path}")

    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(new_rows)

    print(f"labels.csv 업데이트 완료 ({len(new_rows)}개 시퀀스)")

    # 이미지 파일 삭제
    deleted_count = 0
    for img_file in images_to_delete:
        try:
            img_file.unlink()
            deleted_count += 1
        except Exception as e:
            print(f"삭제 실패: {img_file} - {e}")

    print(f"이미지 파일 {deleted_count}개 삭제 완료")

    print("\n=== 동기화 완료 ===")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Sync images and labels from visualization folder")
    parser.add_argument("--data", "-d", type=str, default=None,
                       help="Data directory (default: script_dir/../data/collected)")
    parser.add_argument("--apply", action="store_true",
                       help="Actually apply changes (default is dry-run)")

    args = parser.parse_args()

    sync_from_visualization(data_dir=args.data, dry_run=not args.apply)


if __name__ == "__main__":
    main()
