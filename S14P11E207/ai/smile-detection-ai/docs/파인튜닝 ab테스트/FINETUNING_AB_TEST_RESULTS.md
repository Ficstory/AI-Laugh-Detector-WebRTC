# 파인튜닝 A/B 테스트 결과 보고서

**작성일**: 2026-01-26
**실험자**: AI Team
**목적**: Baseline 모델 대비 파인튜닝 모델의 성능 개선 검증

---

## 📊 실험 개요

### 실험 설계
- **A 그룹**: Baseline 모델 (`smile_detector.onnx`)
- **B 그룹**: Fine-tuned 모델 (`smile_detector_finetuned.onnx`)
- **평가 데이터**: 80개 시퀀스 (Smile: 40, Non-smile: 40)
- **평가 지표**: Accuracy, Precision, Recall, F1 Score, ROC AUC

---

## 🔧 파인튜닝 설정

### 학습 데이터
- **전체 데이터**: 189개 시퀀스
- **Train/Val Split**: 9:1 (Train: 170개, Val: 19개)
- **배치 크기**: 4
- **에폭 수**: **50 epochs**
- **학습률**: 5e-5
- **디바이스**: CPU
- **소요 시간**: 약 7분

### 학습 결과
- **Train Loss**: 0.7079
- **Val Loss**: 0.0003 (거의 완벽)
- **Early Stopping**: 사용하지 않음 (50 epoch 완주)

---

## 📈 성능 비교 결과

### 정량적 지표 (Threshold = 0.5)

| 지표 | Baseline | Fine-tuned | 변화 | 목표 |
|------|----------|------------|------|------|
| **Accuracy** | 65.00% | **62.50%** | ⬇️ -2.5%p | 85%+ |
| **Precision** | 62.50% | **61.36%** | ⬇️ -1.14%p | 85%+ |
| **Recall** | 75.00% | **67.50%** | ⬇️ -7.5%p | 90%+ |
| **F1 Score** | 68.18% | **64.29%** | ⬇️ -3.89%p | 87%+ |
| **ROC AUC** | 0.6606 | **0.7347** | ⬆️ +0.0741 | 0.90+ |

### Confusion Matrix 비교

**Baseline**
```
                 Predicted
                 Non-Smile  Smile
Actual Non-Smile      22      18
Actual Smile          10      30
```

**Fine-tuned**
```
                 Predicted
                 Non-Smile  Smile
Actual Non-Smile      23      17
Actual Smile          13      27
```

### Optimal Threshold

| 모델 | Optimal Threshold | 분석 |
|------|-------------------|------|
| Baseline | 0.8659 | 높은 threshold → 모델이 높은 확률 출력 |
| Fine-tuned | **0.0001** | ⚠️ **매우 낮은 threshold → 모델이 낮은 확률만 출력** |

---

## 🔍 결과 분석

### 1️⃣ 주요 발견
- ✅ **ROC AUC만 소폭 개선** (0.66 → 0.73)
- ❌ **대부분의 지표가 오히려 하락**
- ⚠️ **Val Loss 0.0003인데 Test는 62.5%** → 심각한 과적합

### 2️⃣ 문제점

#### **심각한 과적합 발생**
- **Train 데이터**: 170개로 학습 → Val Loss 0.0003 (거의 완벽)
- **Eval 데이터**: 80개로 평가 → Accuracy 62.5% (실패)
- **원인**: Val 데이터도 Train과 같은 분포 → Eval은 다른 환경/시점 촬영

#### **모델 출력 분포 이상**
- Optimal Threshold가 0.0001 → 모델이 매우 낮은 확률만 출력
- 학습 데이터에만 과도하게 맞춰진 상태

---

## 💡 원인 가설

### 1️⃣ **너무 적은 데이터셋**
- **학습 데이터**: 170개 (매우 부족)
- **일반적 권장**: 최소 1,000~10,000개
- **현재 상태**: 데이터 부족으로 일반화 능력 부족

### 2️⃣ **너무 많은 에폭 수**
- **현재**: 50 epochs
- **문제**: Early Stopping 없이 끝까지 학습 → 과적합 심화
- **증거**: Val Loss 0.0003 (너무 낮음) → 학습 데이터 암기

---

## 🎯 다음 실험 계획

### 실험 2: 에폭 수 조정
- **변경사항**: 50 epochs → **30 epochs**
- **가설**: 에폭 수를 줄여 과적합 완화
- **예상**: Val Loss는 약간 높아지지만, Test 성능은 개선

### 실험 일정
1. ✅ ~~50 epochs 학습 및 평가~~ (완료)
2. ⏭️ **30 epochs 재학습** (다음)
3. ⏭️ **Baseline vs Fine-tuned (30ep) 비교**
4. ⏭️ **추가 데이터 수집 검토** (장기)

---

## 📁 결과 파일

### Baseline 평가
- `data/evaluation/baseline_results_20260122_112534.json`
- `data/evaluation/baseline_roc_20260122_112534.png`

### Fine-tuned (50 epochs) 평가
- `data/evaluation/baseline_results_20260126_112241.json`
- `data/evaluation/baseline_roc_20260126_112241.png`

### 학습 체크포인트
- `checkpoints/finetune_20260126_110716/best_model.pth`
- `checkpoints/finetune_20260126_110716/training_summary.json`
- `models/smile_detector_finetuned.onnx`

---

## 📌 결론

### 현재 상태
> **파인튜닝 후 성능이 오히려 하락함**
> ROC AUC는 소폭 개선되었으나, Accuracy/Precision/Recall 모두 하락

### 원인
1. **데이터 부족** (170개 → 최소 1,000개 필요)
2. **과적합** (50 epochs, Early Stopping 미사용)

### 다음 단계
1. **30 epochs로 재학습** 후 성능 재평가
2. 추가 데이터 수집 검토
3. Regularization 강화 (Dropout 증가 등)

---

**다음 실험**: 30 epochs 파인튜닝 → 성능 비교
