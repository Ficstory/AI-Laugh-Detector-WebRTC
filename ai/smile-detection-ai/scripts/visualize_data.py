"""
시각화 스크립트
- 5프레임 시퀀스를 이미지 그리드로 저장
- 라벨링 전수 검사용
"""

import cv2
import numpy as np
import csv
from pathlib import Path
import argparse


def create_sequence_grid(images: list, label: str, seq_id: str) -> np.ndarray:
    """5프레임을 가로로 이어붙여 그리드 생성"""
    # 이미지 크기 (224x224 가정)
    h, w = images[0].shape[:2]

    # 5프레임 가로로 이어붙이기
    grid = np.hstack(images)

    # 상단에 라벨 정보 추가
    header_height = 40
    header = np.zeros((header_height, grid.shape[1], 3), dtype=np.uint8)

    # 라벨에 따른 배경색
    if label == "smile":
        header[:] = (0, 100, 0)  # 초록 배경
    else:
        header[:] = (100, 100, 100)  # 회색 배경

    # 텍스트 추가
    text = f"{seq_id} | Label: {label.upper()}"
    cv2.putText(header, text, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    # 헤더와 그리드 합치기
    result = np.vstack([header, grid])

    return result


def visualize_dataset(data_dir: str, output_dir: str = None):
    """데이터셋 시각화"""
    data_path = Path(data_dir)
    images_dir = data_path / "images"
    csv_path = data_path / "labels.csv"

    if not csv_path.exists():
        print(f"Error: labels.csv not found in {data_path}")
        return

    # 출력 폴더 설정
    if output_dir:
        output_path = Path(output_dir)
    else:
        output_path = data_path / "visualizations"

    output_path.mkdir(parents=True, exist_ok=True)

    # 라벨별 폴더 생성
    (output_path / "smile").mkdir(exist_ok=True)
    (output_path / "non_smile").mkdir(exist_ok=True)

    # CSV 읽기
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Total sequences: {len(rows)}")

    smile_count = 0
    non_smile_count = 0

    for row in rows:
        seq_id = row['sequence_id']
        label = row['label']

        # 5프레임 로드
        images = []
        for i in range(5):
            frame_path = images_dir / row[f'frame_{i}']
            if frame_path.exists():
                img = cv2.imread(str(frame_path))
                images.append(img)
            else:
                print(f"Warning: {frame_path} not found")
                break

        if len(images) != 5:
            continue

        # 그리드 생성
        grid = create_sequence_grid(images, label, seq_id)

        # 저장
        output_file = output_path / label / f"{seq_id}.jpg"
        cv2.imwrite(str(output_file), grid)

        if label == "smile":
            smile_count += 1
        else:
            non_smile_count += 1

    print(f"\nVisualization complete!")
    print(f"  Smile: {smile_count}")
    print(f"  Non-smile: {non_smile_count}")
    print(f"  Output: {output_path}")


def view_interactive(data_dir: str):
    """인터랙티브 뷰어 - 키보드로 탐색"""
    data_path = Path(data_dir)
    images_dir = data_path / "images"
    csv_path = data_path / "labels.csv"

    if not csv_path.exists():
        print(f"Error: labels.csv not found in {data_path}")
        return

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("No data found")
        return

    print(f"Total sequences: {len(rows)}")
    print("Controls: LEFT/RIGHT to navigate, Q to quit, D to delete current")

    current_idx = 0
    deleted = set()

    while True:
        if current_idx in deleted:
            current_idx = (current_idx + 1) % len(rows)
            continue

        row = rows[current_idx]
        seq_id = row['sequence_id']
        label = row['label']

        # 5프레임 로드
        images = []
        for i in range(5):
            frame_path = images_dir / row[f'frame_{i}']
            if frame_path.exists():
                img = cv2.imread(str(frame_path))
                images.append(img)

        if len(images) != 5:
            current_idx = (current_idx + 1) % len(rows)
            continue

        # 그리드 생성
        grid = create_sequence_grid(images, label, seq_id)

        # 인덱스 정보 추가
        info = f"[{current_idx + 1}/{len(rows)}] Press LEFT/RIGHT to navigate, D to mark for deletion, Q to quit"
        cv2.putText(grid, info, (10, grid.shape[0] - 10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        cv2.imshow("Data Viewer", grid)

        key = cv2.waitKey(0) & 0xFF

        if key == ord('q'):
            break
        elif key == 81 or key == ord('a'):  # LEFT
            current_idx = (current_idx - 1) % len(rows)
        elif key == 83 or key == ord('d'):  # RIGHT
            current_idx = (current_idx + 1) % len(rows)
        elif key == ord('x'):  # Delete mark
            deleted.add(current_idx)
            print(f"Marked for deletion: {seq_id}")
            current_idx = (current_idx + 1) % len(rows)

    cv2.destroyAllWindows()

    if deleted:
        print(f"\nMarked {len(deleted)} sequences for deletion")
        print("Run with --apply-delete to actually delete them")


def main():
    # 스크립트 위치 기준 기본 경로
    script_dir = Path(__file__).resolve().parent
    default_data_dir = script_dir.parent / "data" / "collected"

    parser = argparse.ArgumentParser(description="Visualize collected data")
    parser.add_argument("--data", "-d", type=str, default=str(default_data_dir),
                       help="Data directory")
    parser.add_argument("--output", "-o", type=str, default=None,
                       help="Output directory for visualizations")
    parser.add_argument("--interactive", "-i", action="store_true",
                       help="Interactive viewing mode")

    args = parser.parse_args()

    if args.interactive:
        view_interactive(args.data)
    else:
        visualize_dataset(args.data, args.output)


if __name__ == "__main__":
    main()
