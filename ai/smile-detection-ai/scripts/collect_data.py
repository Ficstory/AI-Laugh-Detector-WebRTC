"""
데이터 수집 스크립트
- 웹캠 실시간 촬영
- 카운트다운 + 안내 메시지 오버레이
- 자동 프레임 추출 (1~2초: non-smile, 4~5초: smile)
- 캐글 형식으로 저장
"""

import cv2
import numpy as np
import os
import csv
import time
from datetime import datetime
from pathlib import Path


class DataCollector:
    def __init__(self, output_dir: str = None, fps: int = 30):
        # 스크립트 위치 기준 절대경로
        if output_dir is None:
            script_dir = Path(__file__).resolve().parent
            output_dir = script_dir.parent / "data" / "collected"
        self.output_dir = Path(output_dir)
        self.fps = fps
        self.frame_size = (224, 224)
        self.sequence_length = 5

        # 촬영 프로토콜 (초)
        self.phases = [
            {"start": 0, "end": 3, "message": "Neutral", "extract": False},
            {"start": 3, "end": 6, "message": "SMILE!", "extract": False},
            {"start": 6, "end": 9, "message": "Stop", "extract": False},
        ]

        # 추출 구간 (초)
        self.extract_ranges = [
            {"start": 1, "end": 2, "label": "non_smile"},
            {"start": 4, "end": 5, "label": "smile"},
        ]

        self.total_duration = 9  # 총 촬영 시간

        # 폴더 생성
        self.images_dir = self.output_dir / "images"
        self.images_dir.mkdir(parents=True, exist_ok=True)

        # CSV 파일 경로
        self.csv_path = self.output_dir / "labels.csv"

        # 세션 ID (타임스탬프 기반)
        self.session_id = None

    def _init_csv(self):
        """CSV 파일 초기화 (없으면 생성)"""
        if not self.csv_path.exists():
            with open(self.csv_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['sequence_id', 'frame_0', 'frame_1', 'frame_2', 'frame_3', 'frame_4', 'label', 'session_id', 'timestamp'])

    def _get_phase(self, elapsed: float) -> dict:
        """현재 시간에 해당하는 phase 반환"""
        for phase in self.phases:
            if phase["start"] <= elapsed < phase["end"]:
                return phase
        return None

    def _draw_overlay(self, frame: np.ndarray, elapsed: float, countdown: int, message: str) -> np.ndarray:
        """프레임에 카운트다운과 메시지 오버레이"""
        overlay = frame.copy()
        h, w = overlay.shape[:2]

        # 반투명 배경
        cv2.rectangle(overlay, (0, 0), (w, 120), (0, 0, 0), -1)
        frame = cv2.addWeighted(overlay, 0.5, frame, 0.5, 0)

        # 카운트다운 숫자 (크게)
        countdown_text = str(countdown)
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 3.0
        thickness = 5

        text_size = cv2.getTextSize(countdown_text, font, font_scale, thickness)[0]
        text_x = (w - text_size[0]) // 2
        text_y = 80

        # 메시지에 따른 색상
        if "SMILE" in message:
            color = (0, 255, 0)  # 초록
        elif "Stop" in message:
            color = (0, 0, 255)  # 빨강
        else:
            color = (255, 255, 255)  # 흰색

        cv2.putText(frame, countdown_text, (text_x, text_y), font, font_scale, color, thickness)

        # 안내 메시지
        msg_font_scale = 1.5
        msg_thickness = 3
        msg_size = cv2.getTextSize(message, font, msg_font_scale, msg_thickness)[0]
        msg_x = (w - msg_size[0]) // 2
        msg_y = h - 30

        cv2.putText(frame, message, (msg_x, msg_y), font, msg_font_scale, color, msg_thickness)

        # 진행 바
        progress = elapsed / self.total_duration
        bar_width = int(w * progress)
        cv2.rectangle(frame, (0, h - 10), (bar_width, h), color, -1)

        return frame

    def _extract_sequences(self, frames: list, frame_times: list) -> list:
        """지정된 구간에서 5프레임 시퀀스 추출"""
        sequences = []

        for extract_range in self.extract_ranges:
            start_time = extract_range["start"]
            end_time = extract_range["end"]
            label = extract_range["label"]

            # 해당 구간의 프레임 인덱스 찾기
            range_frames = []
            for i, t in enumerate(frame_times):
                if start_time <= t < end_time:
                    range_frames.append(i)

            # 5프레임씩 시퀀스 구성
            if len(range_frames) >= self.sequence_length:
                # 균등하게 5프레임 선택
                step = len(range_frames) // self.sequence_length
                for seq_start in range(0, len(range_frames) - self.sequence_length + 1, step):
                    seq_indices = range_frames[seq_start:seq_start + self.sequence_length]
                    if len(seq_indices) == self.sequence_length:
                        seq_frames = [frames[i] for i in seq_indices]
                        sequences.append({
                            "frames": seq_frames,
                            "label": label
                        })

        return sequences

    def _save_sequence(self, sequence: dict, seq_num: int) -> list:
        """시퀀스를 이미지로 저장하고 파일명 반환"""
        filenames = []
        seq_id = f"{self.session_id}_seq{seq_num:04d}"

        for i, frame in enumerate(sequence["frames"]):
            # 224x224로 리사이즈
            resized = cv2.resize(frame, self.frame_size)
            filename = f"{seq_id}_frame{i}.jpg"
            filepath = self.images_dir / filename
            cv2.imwrite(str(filepath), resized)
            filenames.append(filename)

        # CSV에 기록
        with open(self.csv_path, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                seq_id,
                filenames[0], filenames[1], filenames[2], filenames[3], filenames[4],
                sequence["label"],
                self.session_id,
                datetime.now().isoformat()
            ])

        return filenames

    def record_session(self) -> int:
        """한 세션 촬영 및 저장. 저장된 시퀀스 수 반환"""
        self._init_csv()
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FPS, self.fps)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

        if not cap.isOpened():
            print("Error: Cannot open webcam")
            return 0

        print(f"\n=== Session: {self.session_id} ===")
        print("Press SPACE to start recording, Q to quit")

        # 대기 화면
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # 안내 메시지
            cv2.putText(frame, "Press SPACE to start", (50, 50),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.putText(frame, "Press Q to quit", (50, 100),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

            cv2.imshow("Data Collection", frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord(' '):
                break
            elif key == ord('q'):
                cap.release()
                cv2.destroyAllWindows()
                return 0

        # 녹화 시작
        frames = []
        frame_times = []
        start_time = time.time()

        print("Recording started...")

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            elapsed = time.time() - start_time

            if elapsed >= self.total_duration:
                break

            # 프레임 저장
            frames.append(frame.copy())
            frame_times.append(elapsed)

            # 현재 phase 확인
            phase = self._get_phase(elapsed)
            if phase:
                countdown = int(phase["end"] - elapsed) + 1
                message = phase["message"]
            else:
                countdown = 0
                message = ""

            # 오버레이 표시
            display_frame = self._draw_overlay(frame, elapsed, countdown, message)
            cv2.imshow("Data Collection", display_frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cap.release()
        cv2.destroyAllWindows()

        print(f"Recording finished. Total frames: {len(frames)}")

        # 시퀀스 추출 및 저장
        sequences = self._extract_sequences(frames, frame_times)
        print(f"Extracted sequences: {len(sequences)}")

        seq_num = 0
        for seq in sequences:
            self._save_sequence(seq, seq_num)
            seq_num += 1

        print(f"Saved {seq_num} sequences to {self.output_dir}")

        return seq_num

    def run(self, num_sessions: int = 1):
        """여러 세션 연속 촬영"""
        total_sequences = 0

        for i in range(num_sessions):
            print(f"\n>>> Session {i+1}/{num_sessions}")
            count = self.record_session()
            total_sequences += count

            if i < num_sessions - 1:
                print("\nPress SPACE for next session, Q to quit")
                while True:
                    key = cv2.waitKey(0) & 0xFF
                    if key == ord(' '):
                        break
                    elif key == ord('q'):
                        print(f"\nTotal sequences collected: {total_sequences}")
                        return total_sequences

        print(f"\n=== Collection Complete ===")
        print(f"Total sequences: {total_sequences}")
        print(f"Output directory: {self.output_dir}")
        print(f"Labels file: {self.csv_path}")

        return total_sequences


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Collect smile detection training data")
    parser.add_argument("--output", "-o", type=str, default=None,
                       help="Output directory (default: script_dir/../data/collected)")
    parser.add_argument("--sessions", "-n", type=int, default=1,
                       help="Number of recording sessions")
    parser.add_argument("--fps", type=int, default=30,
                       help="Frames per second")

    args = parser.parse_args()

    collector = DataCollector(
        output_dir=args.output,
        fps=args.fps
    )

    collector.run(num_sessions=args.sessions)


if __name__ == "__main__":
    main()
