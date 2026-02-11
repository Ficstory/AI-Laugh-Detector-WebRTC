# Experiment 02: 30 Epochs Fine-tuning

**실험일**: 2026-01-26
**목적**: 에폭 수를 줄여 과적합 완화 (50 → 30)

---

## 🔧 실험 설정

### 학습 파라미터
- **에폭 수**: **30 epochs** (이전: 50)
- **Early Stopping**: Patience 10 (적용됨)
- **배치 크기**: 4
- **학습률**: 5e-5
- **Train/Val Split**: 9:1 (Train: 170, Val: 19)
- **디바이스**: CPU
- **소요 시간**: 약 4.2분

### 학습 결과
- **Best Val Loss**: 0.0011
- **Final Train Loss**: 0.7079 (추정)
- **Early Stopping**: 발동 안 함 (30 epochs 완주)

---

## 📊 성능 평가 결과

### Confusion Matrix

```
                 Predicted
                 Non-Smile  Smile
Actual Non-Smile      30      10
Actual Smile          18      22
```

### 성능 지표 (Threshold = 0.5)

| 지표 | 값 | 비고 |
|------|-----|------|
| **Accuracy** | 65.00% | Baseline과 동일 |
| **Precision** | 68.75% | **Baseline 대비 +6.25%p** ✅ |
| **Recall** | 55.00% | Baseline 대비 -20.0%p ❌ |
| **F1 Score** | 61.11% | Baseline 대비 -7.07%p |
| **ROC AUC** | 0.7325 | Baseline 대비 +0.0719 ✅ |
| **Optimal Threshold** | 0.0004 | ⚠️ 여전히 매우 낮음 |

### 에러 분석

| 에러 유형 | 개수 | 비율 | 설명 |
|-----------|------|------|------|
| **False Positive (FP)** | 10 | 25.0% | 안 웃었는데 웃었다고 판정 (50ep: 17개) |
| **False Negative (FN)** | 18 | 45.0% | **웃었는데 못 찾음** (50ep: 13개) ⚠️ |
| True Positive (TP) | 22 | 55.0% | 웃음 정확히 탐지 |
| True Negative (TN) | 30 | 75.0% | 무표정 정확히 탐지 |

---

## 📈 50 Epochs vs 30 Epochs 비교

| 지표 | 50 Epochs | **30 Epochs** | 변화 |
|------|-----------|---------------|------|
| Accuracy | 62.50% | **65.00%** | ⬆️ +2.5%p |
| Precision | 61.36% | **68.75%** | ⬆️ +7.39%p |
| Recall | 67.50% | **55.00%** | ⬇️ -12.5%p |
| F1 Score | 64.29% | **61.11%** | ⬇️ -3.18%p |
| ROC AUC | 0.7347 | **0.7325** | ⬇️ -0.0022 |
| Val Loss | 0.0003 | **0.0011** | ⬆️ (덜 과적합) |

### 주요 차이점

#### ✅ 개선된 점
1. **Accuracy 회복**: 62.5% → 65.0% (Baseline과 동일)
2. **Precision 향상**: 61.36% → 68.75% (+7.39%p)
3. **과적합 완화**: Val Loss 0.0003 → 0.0011 (덜 암기)

#### ❌ 악화된 점
1. **Recall 하락**: 67.5% → 55.0% (FN 증가: 13 → 18)
2. **F1 Score 하락**: 64.29% → 61.11%

### 해석
- **30 epochs가 50 epochs보다 과적합이 덜함**
- **하지만 학습 부족**: Recall이 낮아짐 (웃음 탐지 능력 저하)
- **Trade-off**: Precision ↑, Recall ↓ → 보수적 예측 경향

---

## 🔍 원인 분석

### 1️⃣ 여전히 데이터 부족
- **학습 데이터**: 170개 (너무 적음)
- **권장량**: 1,000~10,000개
- **결과**: 일반화 능력 부족

### 2️⃣ Optimal Threshold 이상
- **Optimal Threshold**: 0.0004 (거의 0)
- **의미**: 모델이 매우 낮은 확률값만 출력
- **원인**: 학습 데이터 분포와 평가 데이터 분포 불일치

### 3️⃣ Precision-Recall Trade-off
- **30 epochs**: 보수적 예측 → Precision ↑, Recall ↓
- **50 epochs**: 적극적 예측 → Precision ↓, Recall ↑
- **둘 다 균형이 안 맞음**

---

## 💡 결론

### 성능 요약
> **30 epochs는 50 epochs보다 과적합이 덜하지만,**
> **여전히 Baseline 대비 개선이 미미하거나 일부 지표 악화**

### Baseline 대비
- Accuracy: 동일 (65%)
- Precision: **+6.25%p** ✅
- Recall: **-20.0%p** ❌
- F1: **-7.07%p** ❌
- ROC AUC: **+7.19%p** ✅

### 핵심 문제
1. **데이터 부족** (170개 → 최소 1,000개 필요)
2. **학습/평가 데이터 분포 불일치**
3. **모델 출력 분포 이상** (Optimal Threshold 0.0004)

---

## 🎯 다음 단계

### 단기 실험
- [ ] Threshold 조정 실험 (0.5 → 0.0004)
- [ ] Regularization 강화 (Dropout 0.5 → 0.7)
- [ ] Learning Rate 조정 (5e-5 → 1e-4)

### 장기 계획
- [ ] **데이터 추가 수집** (최소 500~1,000개 목표)
- [ ] Data Augmentation 적용
- [ ] Cross-validation으로 robust 평가

---

## 📁 파일 목록

- `results.json` - 평가 결과 (지표, Confusion Matrix)
- `roc_curve.png` - ROC 커브 시각화
- `training_summary.json` - 학습 설정 및 Loss 히스토리
- `README.md` - 본 문서

---

**이전 실험**: [Experiment 01 (50 Epochs)](../experiment_01_50epochs/)
**다음**: 최종 비교 보고서
