"""
PyTorch 모델을 ONNX로 변환
프론트엔드에서 ONNX Runtime Web으로 직접 추론 가능
"""
import torch
import yaml
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent.parent))
from src.models.smile_detector_dual import DualHeadSmileDetector


def export_to_onnx(
    checkpoint_path: str,
    config_path: str,
    output_path: str,
    sequence_length: int = 3,
    opset_version: int = 14
):
    """
    PyTorch 모델을 ONNX로 변환

    Args:
        checkpoint_path: 체크포인트 파일 경로
        config_path: config.yaml 경로
        output_path: 출력 ONNX 파일 경로
        sequence_length: 입력 시퀀스 길이 (기본: 3)
        opset_version: ONNX opset 버전
    """
    # Config 로드
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    # 모델 로드
    model = DualHeadSmileDetector(config['model'])
    checkpoint = torch.load(checkpoint_path, map_location='cpu', weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()

    print(f"모델 로드 완료: {checkpoint_path}")
    print(f"Best Val Loss: {checkpoint.get('val_loss', 'N/A')}")

    # 더미 입력 생성 (batch=1, seq=N, channels=3, height=224, width=224)
    dummy_input = torch.randn(1, sequence_length, 3, 224, 224)

    # ONNX 변환
    print(f"\nONNX 변환 중... (sequence_length={sequence_length})")

    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['smile_prob', 'emotion_logits'],
        dynamic_axes={
            'input': {0: 'batch_size', 1: 'sequence_length'},
            'smile_prob': {0: 'batch_size'},
            'emotion_logits': {0: 'batch_size'}
        }
    )

    print(f"ONNX 변환 완료: {output_path}")

    # 검증
    import onnx
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print("ONNX 모델 검증 완료!")

    # 파일 크기 확인
    import os
    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"파일 크기: {file_size:.2f} MB")

    return output_path


def test_onnx_inference(onnx_path: str, sequence_length: int = 3):
    """ONNX Runtime으로 추론 테스트"""
    import onnxruntime as ort
    import numpy as np

    print(f"\nONNX Runtime 추론 테스트...")

    # 세션 생성
    session = ort.InferenceSession(onnx_path)

    # 입력 정보
    input_info = session.get_inputs()[0]
    print(f"입력: {input_info.name}, shape={input_info.shape}, dtype={input_info.type}")

    # 출력 정보
    for output in session.get_outputs():
        print(f"출력: {output.name}, shape={output.shape}")

    # 더미 입력으로 추론
    dummy_input = np.random.randn(1, sequence_length, 3, 224, 224).astype(np.float32)

    import time
    start = time.time()
    outputs = session.run(None, {'input': dummy_input})
    elapsed = (time.time() - start) * 1000

    smile_prob, emotion_logits = outputs
    print(f"\n추론 결과:")
    print(f"  - smile_prob: {smile_prob[0][0]:.4f}")
    print(f"  - emotion_logits: {emotion_logits[0]}")
    print(f"  - 추론 시간: {elapsed:.2f}ms")


if __name__ == "__main__":
    # 경로 설정
    base_path = Path(__file__).parent.parent
    checkpoint_path = base_path / "checkpoints" / "best_model.pth"
    config_path = base_path / "config.yaml"
    output_path = base_path / "models" / "smile_detector.onnx"

    # 출력 디렉토리 생성
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # 변환
    export_to_onnx(
        str(checkpoint_path),
        str(config_path),
        str(output_path),
        sequence_length=3  # 3프레임
    )

    # 테스트
    test_onnx_inference(str(output_path), sequence_length=3)
