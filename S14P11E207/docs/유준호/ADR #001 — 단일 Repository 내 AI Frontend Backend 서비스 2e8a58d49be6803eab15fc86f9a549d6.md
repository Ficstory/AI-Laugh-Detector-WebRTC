# ADR #001 — 단일 Repository 내 AI/Frontend/Backend 서비스 구조 및 Deployment 오케스트레이션 방식 결정

생성일: 2026년 1월 14일 오후 12:36
담당자: Ryuwon

---

## 1. Context

본 프로젝트는 단일 Repository 내에서 다음 세 서비스를 동시에 개발 및 운영해야 했다.

- AI
- Backend
- Frontend

원래였다면 각각의 서버를 운영하는 것이 맞지만, SSAFY에서 단일 repo, 단일 인스턴스 운영을 해야한다 듣고, 단일 repo에서의 서비스 구분 및 관리와 관련해서 어떻게 짜야할질 많은 고민을 하게되었다.

초기 단계에서는 로컬 개발 편의성과 빠른 iteration이 중요하나, 이후 단일 EC2 기반 배포 및 장기 관점의 CI/CD 도입, 성능 개선, 환경 분리(dev/prod) 가능성이 존재한다.

이에 따라 Repository 내 서비스 구조, Docker Compose 구성 방식, Profile 분리 전략, 실행/배포 UX에 대한 의사결정이 필요하였다.

---

## 2. 고려했던 방식

의사결정 과정에서 탐색했던 주요 대안은 다음 네 가지였다

### **Option A — 서비스별 Docker Compose 분리**

예)

```
ai/docker-compose.yml
backend/docker-compose.yml
frontend/docker-compose.yml
root-compose.yml (optional)

```

**의도**

각 서비스 독립 dev 및 팀 협업 고려

**장점**

- dev UX 우수
- 서비스 구조 명확
- 팀별 분리 쉬움

**단점**

- 운영/배포 단에서 orchestration 중첩
- network/env/image 충돌 가능
- CI/CD 및 rollback이 복잡
- proxy layer 중복 구성 발생

**결과**: **reject**

---

### **Option B — 서비스별 폴더 분리 + 단일 Root Compose + Profiles**

예)

```
ai/
backend/
frontend/
docker-compose.yml (단일)

```

**의도**

운영 단위는 단일 orchestration, 개발은 profiles로 분기

**장점**

- 운영/배포 단순
- CI/CD 단일 pipeline 구성 용이
- scaling 관점 유리
- Compose → Kubernetes 전환 자연스러움

**단점**

- dev Loop 유연성 부족
- 옵션 길어짐(`-profile` 필요)

**결과**: 후보군

---

### **Option C — 서비스별 Compose + Root Compose를 Makefile로 통제**

**의도**

A+B 혼합형으로 dev/ops 균형 확보

**장점**

- dev 팀별 실행 → make backend / make ai
- 운영 단일 orchestrator 유지 가능
- multi-service build 제어 쉬움

**단점**

- 유지 비용 증가
- Makefile이 기능 과도해지면 기술 부채화 가능

**결과**: 후보군

---

**Option D — Multi Repo 분리 (Mono → Multi)**

**의도**

완전 독립 구성 + scaling 최대화

**장점**

- 팀 단위 autonomy 극대화
- 배포 단위 명확

**단점**

- 현재 단계에서는 오버엔지니어링
- context 공유 어려움
- 관리 비용 증가

**결과**: **reject**

---

## 3. 최종 Decision

최종적으로 다음과 같은 결정을 내렸다:

> 폴더는 분리하고 / Compose는 단일 Orchestrator / Dev UX는 Makefile로 보완
> 

```
repo/
 ├ ai/
 ├ backend/
 ├ frontend/
 └ deploy/
     docker-compose.yml
     Makefile
     .env
     proxy-config (optional)
```

---

## 4. 왜 선택하였는지??

1. **협업 비용 최소화**
    
    서비스 구조는 분리되나 실행/배포 기준은 통일.
    
2. **운영/배포 단순화**
    
    중첩 compose는 network/env/image 충돌을 초래함. 단일 orchestrator는 운영 비용 가장 낮음.
    
3. **CI/CD 고려**
    
    image 기반 deploy 시 단일 compose가 rollback 단위·배포 단위 모두 명확함.
    
4. **추후 확장성**
    
    GPU inference scaling, model 업데이트, staging/prod 분리 등 확장 시 compose 단일화가 유리.
    
5. **Dev UX 보완 가능성**
    
    Makefile이 Option A의 개발 편의성을 보완할 수 있어 프로덕션 설계와 개발 편의 간 균형이 잡힘.
    
6. **전환 비용 최소화**
    
    compose 기반 설계는 향후 Kubernetes, ECS, Nomad 전환 시 리팩토링 비용 거의 없음.
    

---

## 5. Trade-offs

**Positive**

- 운영/배포/rollback/CI/CD 비용 감소
- 구조적 복잡도 최소화
- scaling 대비
- Kubernetes 접근성 확보

**Negative**

- 초기 Makefile 설계 비용 발생
- dev 환경에서 compose 옵션 요구
- AI 이미지 빌드가 무거울 수 있음

---

## 6. Future Considerations

- Staging 환경 도입 가능성
- Terraform 기반 infra 선언 여부
- Observability (logs/metrics/tracing)
    - 로깅 부분과 관련해서 추가될 수 있는데, 만약 해당 부분의 경우는 따로 observability 폴더 또는 monitering 폴더 만들어서 분류를 해둘까 생각.
- 현재 생각보다 많은 컨테이너들이 들어갈 예정이라 관리를 위해 k3s 도입도 고려중이기에 전반적으로 변할수도..?