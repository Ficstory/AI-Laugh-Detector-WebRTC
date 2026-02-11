# Baseline 모델 성능 평가 리포트

**평가일**: 2025-01-22
**모델**: smile_detector.onnx (Y자형 듀얼 헤드)
**목적**: 파인튜닝 전후 성능 비교를 위한 Baseline 측정

---

## 1. 평가 데이터셋

| 항목 | 값 |
|------|-----|
| 총 시퀀스 | 80개 |
| Smile | 40개 (50%) |
| Non-smile | 40개 (50%) |
| 프레임/시퀀스 | 5프레임 |
| 이미지 크기 | 224x224 |

### 데이터 수집 방법
- 촬영 프로토콜: 준비(3초) → 웃음(3초) → 멈춤(3초)
- 추출 구간: 1~2초(non-smile), 4~5초(smile)
- FPS: 30

---

## 2. Baseline 성능 (threshold=0.5)

| 지표 | 값 | 비고 |
|------|-----|------|
| **Accuracy** | 65.00% | 전체 정확도 |
| **Precision** | 62.50% | 웃음 판정 중 실제 웃음 비율 |
| **Recall** | 75.00% | 실제 웃음 중 맞춘 비율 |
| **F1 Score** | 68.18% | Precision-Recall 균형 |
| **ROC AUC** | 0.6606 | 모델 분류 능력 |
| **Optimal Threshold** | 0.8659 | Youden's J Index 기준 |

---

## 3. Confusion Matrix

```
                    Predicted
                    Non-Smile    Smile
Actual Non-Smile        22         18
Actual Smile            10         30
```

| 구분 | 값 | 설명 |
|------|-----|------|
| True Negative (TN) | 22 | 안 웃었고, 안 웃었다고 판정 ✅ |
| False Positive (FP) | 18 | 안 웃었는데 웃었다고 판정 ❌ |
| False Negative (FN) | 10 | 웃었는데 안 웃었다고 판정 ❌ |
| True Positive (TP) | 30 | 웃었고, 웃었다고 판정 ✅ |

---

## 4. 분석

### 주요 발견
1. **FP가 많음** (18건): 안 웃었는데 웃었다고 판정하는 경우가 많음
2. **Recall > Precision**: 모델이 웃음에 민감하게 반응
3. **AUC 0.66**: 랜덤(0.5) 대비 낫지만 개선 여지 많음

### 문제점
- 현재 threshold 0.5에서 FP가 많아 게임에서 억울한 패배 발생 가능
- Optimal threshold(0.87)를 적용하면 FP 감소 가능하나 FN 증가 우려

---

## 5. 파인튜닝 목표

| 지표 | Baseline | 목표 | 개선폭 |
|------|----------|------|--------|
| Accuracy | 65.00% | 85%+ | +20% |
| Precision | 62.50% | 85%+ | +22.5% |
| Recall | 75.00% | 90%+ | +15% |
| F1 Score | 68.18% | 87%+ | +19% |
| ROC AUC | 0.6606 | 0.90+ | +0.24 |

---

## 6. 결과 파일

- 상세 결과: `data/evaluation/baseline_results_20260122_112534.json`
- ROC 커브: `data/evaluation/baseline_roc_20260122_112534.png`

---

## 7. 다음 단계

1. 파인튜닝 실행
2. 동일 데이터셋으로 파인튜닝 모델 평가
3. Baseline과 비교 리포트 작성

---

*작성: Claude*
*최종 수정: 2025-01-22*
