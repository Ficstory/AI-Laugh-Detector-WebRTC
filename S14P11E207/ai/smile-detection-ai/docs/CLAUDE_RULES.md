# Claude 작업 규칙

## 최우선 원칙: 토큰 최소화

---

## 1. 스코프 제한

- **작업 폴더**: `ai/smile-detection-ai/` 만 접근
- **금지**: 백엔드, 프론트엔드 폴더 절대 접근 금지
- **작업 시작 시**: `cd ai/smile-detection-ai/`

---

## 2. 토큰 절약 전략

### 코드 읽기 최소화
- 전체 코드를 매번 읽지 않음
- **먼저** `docs/` 폴더의 md 파일 확인
- md 파일 기반으로 필요한 파일만 선택적 접근

### 참조 우선순위
1. `docs/TODO_ISSUES.md` - 현재 작업 상태
2. `docs/PROJECT_STRUCTURE.md` - 프로젝트 구조
3. `docs/NOTION_*.md` - 핵심 설계 문서 (필독)
4. 해당 md에서 언급된 파일만 직접 확인

---

## 3. 문서화 규칙

### 변경 발생 시
- `docs/TODO_ISSUES.md`에 변경 내용 기록
- 구조 변경 시 `docs/PROJECT_STRUCTURE.md` 업데이트

### 핵심 문서 (필독)
| 파일 | 용도 |
|------|------|
| `NOTION_01_프로젝트_기획.md` | 프로젝트 개요, 요구사항 |
| `NOTION_02_아키텍처_상세설계.md` | 모델 아키텍처 상세 |
| `NOTION_03_의사결정_기록.md` | 기술 의사결정 근거 |

### 운영 문서
| 파일 | 용도 |
|------|------|
| `CLAUDE_RULES.md` | 이 파일. Claude 작업 규칙 |
| `TODO_ISSUES.md` | 현재 작업 상태, 다음 할 일 |
| `PROJECT_STRUCTURE.md` | 프로젝트 구조 요약 |
| `API_SPEC.md` | API 명세 |

---

## 4. 모델 아키텍처 이해

**Y자형 듀얼 헤드 모델**:
- CNN (MobileNetV3) + LSTM 구조
- **분류 헤드**: 8가지 표정 분류
- **회귀 헤드**: 웃음 정밀 수치 (0~1)

**현재 설정**:
- 입력: (1, 5, 3, 224, 224) - 5프레임 시퀀스
- Window: 5, Stride: 4

---

## 5. FastAPI 서버 작업

- API 명세서는 `docs/API_SPEC.md` 참조
- 프론트/백엔드 코드 참조 없이 명세서 기반 작업

---

## 6. 세션 시작 시 Claude에게 전달할 내용

```
ai/smile-detection-ai/docs/CLAUDE_RULES.md 읽고,
ai/smile-detection-ai/docs/TODO_ISSUES.md 확인해서 이어서 작업해
```

---

*최종 수정: 2025-01-22*
