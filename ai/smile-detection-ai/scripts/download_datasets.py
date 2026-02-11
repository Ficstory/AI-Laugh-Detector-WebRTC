"""
데이터셋 자동 다운로드 스크립트
- GENKI-4K, FER2013, SMILES 데이터셋 Kaggle에서 자동 다운로드
- 압축 해제 및 디렉토리 구조 정리
"""
import os
import sys
import subprocess
from pathlib import Path
import zipfile
import shutil


def check_kaggle_api():
    """Kaggle API 설치 및 설정 확인"""
    print("\n" + "="*60)
    print("Kaggle API 확인")
    print("="*60)

    try:
        result = subprocess.run(
            ["kaggle", "--version"],
            capture_output=True,
            text=True,
            check=True
        )
        print(f"✓ Kaggle API 설치됨: {result.stdout.strip()}")
        return True
    except FileNotFoundError:
        print("✗ Kaggle API가 설치되지 않았습니다.")
        print("\n설치 방법:")
        print("  pip install kaggle")
        return False
    except subprocess.CalledProcessError as e:
        print(f"✗ Kaggle API 설정 오류: {e.stderr}")
        print("\nKaggle API 토큰 설정 필요:")
        print("  1. https://www.kaggle.com/settings/account")
        print("  2. 'Create New API Token' 클릭")
        print("  3. kaggle.json을 다음 위치에 저장:")
        print(f"     Windows: C:\\Users\\사용자명\\.kaggle\\kaggle.json")
        print(f"     Linux/Mac: ~/.kaggle/kaggle.json")
        return False


def create_directories(base_dir: Path):
    """데이터 디렉토리 생성"""
    print("\n" + "="*60)
    print("디렉토리 생성")
    print("="*60)

    dirs = [
        base_dir / "raw" / "genki4k",
        base_dir / "raw" / "fer2013",
        base_dir / "raw" / "smiles",
        base_dir / "processed",
        base_dir / "collected",
    ]

    for dir_path in dirs:
        dir_path.mkdir(parents=True, exist_ok=True)
        print(f"✓ {dir_path}")


def download_dataset(dataset_name: str, kaggle_path: str, output_dir: Path):
    """Kaggle 데이터셋 다운로드"""
    print(f"\n다운로드 중: {dataset_name}")
    print(f"  Kaggle: {kaggle_path}")
    print(f"  저장 위치: {output_dir}")

    try:
        # Kaggle CLI로 다운로드
        subprocess.run(
            ["kaggle", "datasets", "download", "-d", kaggle_path, "-p", str(output_dir)],
            check=True,
            capture_output=True,
            text=True
        )
        print(f"✓ 다운로드 완료")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ 다운로드 실패: {e.stderr}")
        return False


def extract_zip(zip_path: Path, extract_to: Path):
    """ZIP 파일 압축 해제"""
    print(f"\n압축 해제 중: {zip_path.name}")

    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
        print(f"✓ 압축 해제 완료")

        # ZIP 파일 삭제
        zip_path.unlink()
        print(f"✓ ZIP 파일 삭제: {zip_path.name}")
        return True
    except Exception as e:
        print(f"✗ 압축 해제 실패: {e}")
        return False


def download_genki4k(data_dir: Path):
    """GENKI-4K 다운로드"""
    print("\n" + "="*60)
    print("GENKI-4K 다운로드 (웃음 감지 데이터셋)")
    print("="*60)

    output_dir = data_dir / "raw" / "genki4k"

    if download_dataset("GENKI-4K", "talhasar/genki4k", output_dir):
        # ZIP 파일 찾기
        zip_files = list(output_dir.glob("*.zip"))
        if zip_files:
            extract_zip(zip_files[0], output_dir)
            return True
    return False


def download_fer2013(data_dir: Path):
    """FER2013 다운로드"""
    print("\n" + "="*60)
    print("FER2013 다운로드 (표정 분류 데이터셋)")
    print("="*60)

    output_dir = data_dir / "raw" / "fer2013"

    if download_dataset("FER2013", "msambare/fer2013", output_dir):
        # ZIP 파일 찾기
        zip_files = list(output_dir.glob("*.zip"))
        if zip_files:
            extract_zip(zip_files[0], output_dir)
            return True
    return False


def download_smiles(data_dir: Path):
    """SMILES 다운로드 (선택적)"""
    print("\n" + "="*60)
    print("SMILES 다운로드 (웃음 감지 보조 데이터셋)")
    print("="*60)

    output_dir = data_dir / "raw" / "smiles"

    # SMILES 데이터셋은 여러 버전이 있을 수 있음
    # 여기서는 예시로 하나만 시도
    print("⚠️  SMILES 데이터셋은 Kaggle에 공식 버전이 없을 수 있습니다.")
    print("   필요시 수동으로 다운로드하세요.")
    return False


def verify_datasets(data_dir: Path):
    """다운로드된 데이터셋 확인"""
    print("\n" + "="*60)
    print("데이터셋 확인")
    print("="*60)

    datasets = {
        "GENKI-4K": data_dir / "raw" / "genki4k",
        "FER2013": data_dir / "raw" / "fer2013",
    }

    results = {}
    for name, path in datasets.items():
        if path.exists():
            # 파일 개수 확인
            files = list(path.rglob("*"))
            file_count = len([f for f in files if f.is_file()])
            results[name] = file_count
            print(f"✓ {name}: {file_count:,} files")
        else:
            results[name] = 0
            print(f"✗ {name}: 없음")

    return results


def main():
    """메인 함수"""
    print("\n" + "="*60)
    print("데이터셋 자동 다운로드 시작")
    print("="*60)

    # 프로젝트 루트 경로
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    data_dir = project_root / "data"

    print(f"\n프로젝트 루트: {project_root}")
    print(f"데이터 디렉토리: {data_dir}")

    # 1. Kaggle API 확인
    if not check_kaggle_api():
        print("\n❌ Kaggle API 설정을 완료한 후 다시 실행하세요.")
        return 1

    # 2. 디렉토리 생성
    create_directories(data_dir)

    # 3. 사용자 선택
    print("\n" + "="*60)
    print("다운로드할 데이터셋 선택")
    print("="*60)
    print("1. GENKI-4K (필수)")
    print("2. FER2013 (필수)")
    print("3. SMILES (선택)")
    print("4. 전체 다운로드 (GENKI-4K + FER2013)")
    print("5. 종료")

    choice = input("\n선택 (1-5): ").strip()

    success = True

    if choice == "1":
        success = download_genki4k(data_dir)
    elif choice == "2":
        success = download_fer2013(data_dir)
    elif choice == "3":
        success = download_smiles(data_dir)
    elif choice == "4":
        genki_success = download_genki4k(data_dir)
        fer_success = download_fer2013(data_dir)
        success = genki_success and fer_success
    elif choice == "5":
        print("\n종료합니다.")
        return 0
    else:
        print("\n❌ 잘못된 선택입니다.")
        return 1

    # 4. 결과 확인
    verify_datasets(data_dir)

    if success:
        print("\n" + "="*60)
        print("✅ 다운로드 완료!")
        print("="*60)
        print(f"\n다음 단계:")
        print(f"  1. 데이터 확인: ls {data_dir / 'raw'}")
        print(f"  2. Baseline 학습: python train.py")
        return 0
    else:
        print("\n" + "="*60)
        print("❌ 일부 다운로드 실패")
        print("="*60)
        return 1


if __name__ == "__main__":
    sys.exit(main())
