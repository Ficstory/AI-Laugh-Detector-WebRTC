"""
설정 파일 로더
YAML 설정 파일을 읽고 파싱하는 유틸리티
"""
import yaml
from pathlib import Path
from typing import Dict, Any


class Config:
    """설정 관리 클래스"""

    def __init__(self, config_path: str = "config.yaml"):
        """
        Args:
            config_path: YAML 설정 파일 경로
        """
        self.config_path = Path(config_path)
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        """YAML 파일 로드"""
        if not self.config_path.exists():
            raise FileNotFoundError(f"설정 파일을 찾을 수 없습니다: {self.config_path}")

        with open(self.config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        return config

    def get(self, *keys, default=None):
        """
        중첩된 키로 설정값 가져오기

        Args:
            *keys: 중첩된 키 (예: 'model', 'backbone')
            default: 키가 없을 때 반환할 기본값

        Returns:
            설정값

        Example:
            config.get('model', 'backbone')  # 'mobilenet_v3_small'
        """
        value = self.config
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value

    def __getitem__(self, key):
        """딕셔너리처럼 접근"""
        return self.config[key]

    def __contains__(self, key):
        """in 연산자 지원"""
        return key in self.config

    @property
    def data(self) -> Dict[str, Any]:
        """데이터 설정 반환"""
        return self.config.get('data', {})

    @property
    def model(self) -> Dict[str, Any]:
        """모델 설정 반환"""
        return self.config.get('model', {})

    @property
    def training(self) -> Dict[str, Any]:
        """학습 설정 반환"""
        return self.config.get('training', {})

    @property
    def inference(self) -> Dict[str, Any]:
        """추론 설정 반환"""
        return self.config.get('inference', {})

    @property
    def api(self) -> Dict[str, Any]:
        """API 설정 반환"""
        return self.config.get('api', {})

    @property
    def logging(self) -> Dict[str, Any]:
        """로깅 설정 반환"""
        return self.config.get('logging', {})


def load_config(config_path: str = "config.yaml") -> Config:
    """
    설정 파일 로드 (편의 함수)

    Args:
        config_path: YAML 설정 파일 경로

    Returns:
        Config 객체
    """
    return Config(config_path)
