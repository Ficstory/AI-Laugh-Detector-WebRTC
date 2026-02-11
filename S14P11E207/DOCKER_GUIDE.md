# Docker Compose 환경별 설정 가이드

> **ADR #003** 기반 - Docker Compose를 이용한 환경 분류 전략

## 📌 핵심 원칙

### Infra / App 분리 전략

본 프로젝트는 **인프라(Infra)**와 **애플리케이션(App)**을 명확히 분리하여 관리합니다.

| 구분 | 포함 서비스 | 관리 방식 |
|------|-------------|-----------|
| **Infra Stack** | MySQL, Redis, MinIO, Nginx, Jenkins, Grafana/Loki, OpenVidu | 상시 기동, 별도 관리 |
| **App Stack** | WAS (Blue/Green) | 배포 시에만 재시작 |

**왜 분리하는가?**
- `docker compose down` 실행 시 DB, 캐시, 스토리지까지 중단되는 위험 방지
- 배포 과정에서 인프라가 영향받지 않도록 구조적으로 차단
- 운영 실수로 인한 대규모 장애 방지
- Blue-Green 무중단 배포와 자연스럽게 정합

---

## 📁 디렉토리 구조

```
project-root/
├── infra/                          # 인프라 스택 (상시 기동)
│   ├── docker-compose.yml          # Jenkins, Nginx 등 기본 인프라
│   ├── docker-compose.data.dev.yml # MySQL, Redis, MinIO (Dev)
│   ├── docker-compose.data.prod.yml # MySQL, Redis, MinIO (Prod)
│
├── backend/                        # 애플리케이션 스택
│   ├── docker-compose.yml          # WAS 기본 정의
│   ├── docker-compose.local.yml    # 로컬 개발 (Full Stack)
│   ├── docker-compose.dev.yml      # 개발 서버 (WAS만)
│   └── docker-compose.prod.yml     # 운영 서버 (WAS만)
│
└── scripts/                        # 배포 스크립트
    ├── deploy-blue.sh
    └── deploy-green.sh
```

---

## 🖥️ 환경 개요

| 환경 | 용도 | 인프라 | WAS | 특징 |
|------|------|--------|-----|------|
| **local** | 개발자 PC | Docker (Full Stack) | 1개 | 빠른 개발, 전체 스택 로컬 실행 |
| **dev** | 팀 공유 개발 서버 | infra stack (별도) | 2개 (Blue+Green) | 통합 테스트, QA |
| **prod** | 실제 서비스 운영 | infra stack (별도) | 2개 (Blue+Green) | 무중단 배포, 모니터링 |

---

## 🖥️ Local (로컬 개발 환경)

### 목적
- 개발자 개인의 기능 개발 및 통합 테스트
- IDE에서 빠른 디버깅
- 단일 개발자가 전체 스택을 로컬에서 기동

### 특징
- ✅ **Full Stack** - MySQL, Redis, MinIO, WAS 모두 Docker로 실행
- ✅ WAS 1개만 실행 (Blue-Green 불필요)
- ✅ 포트 직접 노출로 빠른 테스트
- ✅ 데이터 및 인프라 재시작에 대한 부담 없음

### 실행 명령어
```powershell
cd backend
docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

### 중지 명령어
```powershell
cd backend
docker-compose -f docker-compose.yml -f docker-compose.local.yml down
```

### 접근 URL
| 서비스 | URL |
|--------|-----|
| API | `http://localhost:8081` |
| MySQL | `localhost:3307` |
| Redis | `localhost:6380` |
| MinIO Console | `http://localhost:9001` |

### 아키텍처
```
┌─────────────────────────────────────────────────────────────────┐
│                         Local PC (Docker)                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Docker Network                        │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────┐   │    │
│  │  │  MySQL  │  │  Redis  │  │  MinIO  │  │    WAS    │   │    │
│  │  │  :3307  │  │  :6380  │  │  :9001  │  │   :8081   │   │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └───────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Dev / Staging (개발 서버 환경)

### 목적
- 팀 단위 통합 테스트 및 QA
- 프론트엔드와 통합 테스트
- 개발자/기획/프론트엔드가 동일한 데이터 환경 공유

### 특징
- ✅ **Infra는 별도 Stack으로 분리** (상시 기동)
- ✅ WAS만 배포 대상
- ✅ Blue/Green 둘 다 실행 (배포 연습 가능)
- ✅ Nginx 리버스 프록시 사용
- ✅ DEBUG 로그 레벨

### 실행 순서

**1단계: 인프라 스택 기동 (최초 1회)**
```bash
cd infra
docker-compose up -d                              # Jenkins
docker-compose -f docker-compose.data.dev.yml up -d     # MySQL, Redis, MinIO
```

**2단계: 애플리케이션 배포**
```bash
cd backend
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### ⚠️ 주의사항
```bash
# ❌ 절대 하지 말 것 - 인프라까지 중단됨
docker-compose down

# ✅ WAS만 재시작
docker-compose restart was-blue was-green
```

### 아키텍처
```
┌────────────────────────────────────────────────────────────────────────┐
│                           Dev Server                                   │
│                                                                        │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────┐  │
│  │         Infra Stack (상시 기동)       │  │     App Stack (배포)    │  │
│  │  ┌───────┐ ┌───────┐ ┌───────┐      │  │  ┌────────┐ ┌─────────┐ │  │
│  │  │ MySQL │ │ Redis │ │ MinIO │      │  │  │WAS Blue│ │WAS Green│ │  │
│  │  └───┬───┘ └───┬───┘ └───┬───┘      │  │  │ :8081  │ │ :8082   │ │  │
│  │      │         │         │          │  │  └────┬───┘ └────┬────┘ │  │
│  │      └─────────┼─────────┘          │  │       └─────┬────┘      │  │
│  │                │      external net  │  │             │           │  │
│  └────────────────┼────────────────────┘  └─────────────┼───────────┘  │
│                   │                                     │              │
│                   └──────────────┬──────────────────────┘              │
│                            ┌─────┴─────┐                               │
│                            │   Nginx   │ :80                           │
│                            └───────────┘                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Production (운영 환경)

### 목적
- 실제 사용자에게 서비스
- 안정적인 운영, 무중단 배포, 빠른 롤백

### 특징
- ✅ **인프라 완전 분리** - 배포 과정에서 인프라 영향 없음
- ✅ CPU/메모리 리소스 제한 (안정성)
- ✅ SSL/HTTPS 지원
- ✅ Grafana/Loki 모니터링
- ✅ INFO 로그 레벨 (성능 최적화)
- ✅ 무중단 배포 (Blue-Green)

### 실행 순서

**1단계: 인프라 스택 기동 (최초 1회, 이후 상시 유지)**
```bash
cd infra
docker-compose up -d                                    # Jenkins, Nginx
docker-compose -f docker-compose.data.prod.yml up -d           # MySQL, Redis, MinIO
docker-compose --profile monitoring up -d   # Grafana, Loki (in docker-compose.yml)
```

**2단계: 애플리케이션 무중단 배포**
```bash
# Blue 배포
./scripts/deploy-blue.sh

# Green으로 전환
./scripts/deploy-green.sh

# 트래픽 전환
./scripts/switch-upstream.sh
```

### ⚠️ 절대 금지 사항
```bash
# ❌ 절대 하지 말 것 - 서비스 전체 장애 발생
cd infra && docker-compose down

# ❌ 절대 하지 말 것 - DB 데이터 손실 위험
docker volume rm mysql-data
```

### 아키텍처
```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Production Server                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                    Infra Stack (상시 기동, 절대 중단 금지)            │    │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────────┐ ┌─────────┐ ┌───────┐  │    │
│  │  │ MySQL │ │ Redis │ │ MinIO │ │  OpenVidu │ │ Grafana │ │  Loki │  │    │
│  │  │  4GB  │ │  2GB  │ │  2GB  │ │           │ │  :8300  │ │       │  │    │
│  │  └───────┘ └───────┘ └───────┘ └───────────┘ └─────────┘ └───────┘  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                              │ external network                              │
│  ┌───────────────────────────┼──────────────────────────────────────────┐    │
│  │                App Stack (배포 대상, 재시작 가능)                     │    │
│  │           ┌───────────────┼───────────────┐                          │    │
│  │           │               │               │                          │    │
│  │      ┌────┴────┐    ┌────┴────┐          │                          │    │
│  │      │WAS Blue │    │WAS Green│          │                          │    │
│  │      │   3GB   │    │   3GB   │──────────┘ (로그 전송)               │    │
│  │      └────┬────┘    └────┬────┘                                      │    │
│  │           └──────┬───────┘                                           │    │
│  └──────────────────┼───────────────────────────────────────────────────┘    │
│                ┌────┴────┐                                                   │
│                │  Nginx  │ :80, :443 (SSL)                                   │
│                └─────────┘                                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 네트워크 구성

### 분리된 네트워크
```yaml
networks:
  # 인프라 전용 네트워크 (infra stack에서 생성)
  infra-net:
    name: infra-net
    driver: bridge

  # 애플리케이션 네트워크 (backend stack에서 생성)
  app-network:
    name: app-network
    driver: bridge
```

### App에서 Infra 연결 (external 참조)
```yaml
# backend/docker-compose.dev.yml 또는 prod.yml
networks:
  infra-net:
    external: true  # infra stack에서 생성한 네트워크 참조
  app-network:
    driver: bridge
```

---

## 📊 환경별 리소스 제한

| 서비스 | Local | Dev | Prod |
|--------|-------|-----|------|
| **MySQL** | 제한 없음 | 2GB | 4GB |
| **Redis** | 제한 없음 | 256MB | 1GB |
| **MinIO** | 제한 없음 | 1GB | 2GB |
| **WAS** | 512MB | 1.5GB | 3GB |

---

## 📁 환경변수 파일 (.env) 관리

### 파일 위치
| 위치 | 용도 |
|------|------|
| `backend/.env` | 애플리케이션 (WAS) 환경변수 |
| `infra/.env` | 인프라 스택 환경변수 |

### 초기 설정
```bash
# Backend
cd backend
cp .env.example .env
# .env 파일을 열어 값 수정

# Infra (서버에서만 필요)
cd infra
cp .env.example .env
# .env 파일을 열어 값 수정
```

### 환경별 값
| 항목 | Local | Dev | Prod |
|------|-------|-----|------|
| **SPRING_PROFILES_ACTIVE** | local | dev | prod |
| **JWT_SECRET_KEY** | 개발용 키 | 개발용 키 | ⚠️ 강력한 운영 키 |
| **DB 비밀번호** | 개발용 | 개발용 | ⚠️ 강력한 비밀번호 |
| **LOG_LEVEL** | DEBUG | DEBUG | INFO |

### 보안 주의사항
- ⚠️ `.env` 파일들은 모두 `.gitignore`에 포함됨
- ⚠️ `.env.example` 파일만 Git에 커밋 (민감 정보 제외)
- ⚠️ 운영 환경에서는 강력한 비밀번호/시크릿 키 사용

---

## 🔄 배포 워크플로우

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Local (PC)    │     │   Dev Server    │     │  Prod Server    │
│                 │     │                 │     │                 │
│  Full Stack     │     │  WAS만 배포     │     │  WAS만 배포     │
│  (개발 생산성)   │────►│  (통합 테스트)   │────►│  (무중단 배포)   │
│                 │     │                 │     │                 │
│  docker-compose │     │  infra 별도     │     │  infra 별도     │
│  local.yml      │     │  + app 배포     │     │  + Blue/Green   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       │                        │                       │
       ▼                        ▼                       ▼
   git push ──────────────► Jenkins CI/CD ──────────► 자동 배포
```

---

## 💡 자주 사용하는 명령어

### Make 명령어 (권장)

프로젝트 루트에서 `make` 명령어를 사용하면 편리합니다:

```bash
# 도움말 보기
make help

# 로컬 개발 환경
make local-up           # 실행
make local-down         # 중지
make local-logs         # 로그

# 인프라 스택 (서버)
make data-prod-up       # DB 스택 실행 (MySQL, Redis, MinIO)
make jenkins-up         # Jenkins 실행
make infra-all-up       # 전체 인프라 실행 (Data + Jenkins + Nginx)
make status             # 상태 확인

# 개발/운영 환경 (서버)
make dev-up             # 개발 WAS 실행
make prod-up            # 운영 WAS 실행
make deploy-blue        # Blue 배포
make switch-green       # Green 트래픽 전환

# 로그
make logs-mysql         # MySQL 로그
make logs-was-blue      # WAS Blue 로그
```

### Docker Compose 직접 명령어

```bash
# 로그 확인
docker-compose logs -f was-blue

# 모든 서비스 로그
docker-compose logs -f
```

### 컨테이너 상태 확인
```bash
docker-compose ps
```

### WAS만 재시작 (인프라 유지)
```bash
docker-compose restart was-blue
```

### 특정 서비스만 재빌드
```bash
docker-compose up -d --build was-blue
```

### 볼륨 데이터 확인
```bash
docker volume ls
docker volume inspect mysql-data
```

---

## 📚 관련 문서

- [ADR #003 - Docker Compose를 이용한 환경 분류](./docs/유준호/)
- [infra/README.md](./infra/README.md) - 인프라 스택 상세 가이드
- [Makefile](./Makefile) - 전체 운영 명령어 목록

