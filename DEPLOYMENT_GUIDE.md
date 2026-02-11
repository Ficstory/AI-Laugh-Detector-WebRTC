# =============================================================================
# 배포 가이드 (Deployment Guide)
# =============================================================================
#
# Smile Battle - 무중단 배포 및 운영 가이드
# ADR#003 기반 Stateful/Stateless 분리 아키텍처
#
# =============================================================================

## 📋 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [사전 요구사항](#2-사전-요구사항)
3. [초기 배포 절차](#3-초기-배포-절차)
4. [일상 운영](#4-일상-운영)
5. [Blue/Green 배포](#5-bluegreen-배포)
6. [모니터링 시스템](#6-모니터링-시스템)
7. [트러블슈팅](#7-트러블슈팅)
8. [레거시 명령어](#8-레거시-명령어-호환)

---

## 1. 아키텍처 개요

### 1.1 핵심 설계 원칙 (ADR#003)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Stateful/Stateless 분리 전략                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ 장점:                                                                   │
│  • WAS 배포/재시작 시 DB 영향 없음                                             │
│  • 운영자 실수로 인한 대규모 장애 방지                                           │
│  • 빠른 롤백 가능                                                             │
│                                                                             │
│  📦 Data Layer (Stateful):                                                 │
│  • MySQL, Redis, MinIO                                                      │
│  • 거의 재시작하지 않음                                                        │
│  • infra/docker-compose.data.prod.yml                                       │
│                                                                             │
│  🚀 App Layer (Stateless):                                                 │
│  • WAS (Blue/Green), Frontend                                               │
│  • 배포 시마다 재시작                                                         │
│  • backend/docker-compose.yml, frontend/docker-compose.prod.yml             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 네트워크 구조

| 네트워크 | 용도 | 비고 |
|----------|------|------|
| prod-net | Production 환경 | Bridge (Dynamic IP) |
| dev-net | Development 환경 | Bridge (Dynamic IP) |
| infra-net | Jenkins, Nginx Proxy | Bridge |

### 1.3 서비스 호스트네임 (Production)

Docker 네트워크 내부에서는 IP 대신 **호스트네임**을 사용합니다.

| 서비스 | 호스트네임 | 포트 |
|--------|-----|------|
| prod-frontend | `prod-frontend` | 80 |
| prod-was-blue | `prod-was-blue` | 8081 |
| prod-was-green | `prod-was-green` | 8082 |
| prod-mysql | `prod-mysql` | 3306 |
| prod-redis | `prod-redis` | 6379 |
| prod-minio | `prod-minio` | 9000 |
| loki | `loki` | 3100 |
| grafana | `grafana` | 3000 |

---

## 2. 사전 요구사항

### 2.1 EC2 인스턴스

- **사양**: t3.xlarge (4 vCPU, 16GB RAM)

### 2.2 Security Group 설정

```
┌────────────────────────────────────────────────────────────────┐
│   Port   │ Protocol │   Source    │         Service            │
├──────────┼──────────┼─────────────┼────────────────────────────┤
│    22    │   TCP    │  관리자 IP  │  SSH                       │
│    80    │   TCP    │  0.0.0.0/0  │  HTTP → Nginx              │
│   443    │   TCP    │  0.0.0.0/0  │  HTTPS → Nginx             │
│   8080   │   TCP    │  관리자 IP  │  Jenkins (IP 제한)         │
│   8443   │   TCP    │  0.0.0.0/0  │  OpenVidu HTTPS            │
└────────────────────────────────────────────────────────────────┘
```

### 2.3 필수 소프트웨어

```bash
# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose 설치 (Docker 포함)
# 최신 Docker는 compose plugin 포함

# Make 설치
sudo apt install make -y
```

### 2.4 환경 변수 파일

프로젝트는 환경별로 분리된 .env 파일을 사용합니다.

#### 파일 위치

```
/home/ubuntu/project/
├── .env.prod         # Production 환경 변수
├── .env.dev          # Development 환경 변수
└── backend/.env      # 로컬 개발용 (Git에 포함됨)
```

#### Production 환경 변수 (.env.prod)

| 변수 | 설명 | 예시 |
|------|------|------|
| `SPRING_PROFILES_ACTIVE` | Spring 프로필 | `prod` |
| `JWT_SECRET_KEY` | JWT 시크릿 (base64) | `openssl rand -base64 32` |
| `MYSQL_ROOT_PASSWORD` | MySQL root 비밀번호 | 강력한 무작위 문자열 |
| `MYSQL_DATABASE` | 데이터베이스명 | `dontlaugh_db` |
| `MYSQL_USER` | 앱 DB 사용자 | `produser` |
| `MYSQL_PASSWORD` | 앱 DB 비밀번호 | 강력한 무작위 문자열 |
| `MINIO_ROOT_USER` | MinIO 관리자 | `prodadmin` |
| `MINIO_ROOT_PASSWORD` | MinIO 비밀번호 | 강력한 무작위 문자열 |
| `KAKAO_*` | Kakao OAuth 설정 | Kakao Developers 발급 |
| `NAVER_*` | Naver OAuth 설정 | Naver Developers 발급 |
| `GOOGLE_*` | Google OAuth 설정 | GCP Console 발급 |
| `OPENVIDU_URL` | OpenVidu 서버 URL | `https://도메인:8443` |
| `OPENVIDU_SECRET` | OpenVidu 시크릿 | OpenVidu 설치 시 생성 |
| `GRAFANA_ADMIN_*` | Grafana 인증 | 모니터링 접근용 |
| `VITE_API_URL` | Frontend API 경로 | `/api` |
| `APP_CORS_ALLOWED_ORIGINS` | CORS 허용 도메인 | `https://i14e207.p.ssafy.io` |
| `MINIO_EXTERNAL_ENDPOINT` | MinIO 외부 접근 (Presigned) | `https://.../objects` |
| `DOCKER_GID` | Docker Group ID | `988` (호스트 GID) |

#### MinIO 설정 (중요)
142: 
143: MinIO는 Nginx를 통해 외부에서 접근 가능해야 합니다 (`/objects/` 경로).
144: 프로필 이미지 등의 공개 리소스가 정상적으로 로드되려면 **Bucket Policy**를 `Public`으로 설정해야 합니다.
145: 
146: 1. MinIO Console 접속 (`https://도메인:9001` 또는 포트 포워딩)
147: 2. Buckets -> `profile-images` (예시) 클릭
148: 3. Access Policy를 `Public` (Read Only)으로 설정
149: 
150: #### 초기 설정 및 보안

```bash
# 1. 프로젝트 루트에 환경 변수 파일 생성
cd /home/ubuntu/project
# 2. .env.prod 파일 편집 (실제 값으로 수정)
nano .env.prod

# 3. 권한 설정 (보안 - 관리자만 읽기 가능)
chmod 600 .env.prod .env.dev

# 4. .gitignore 확인 (이미 포함되어 있어야 함)
grep ".env.prod" .gitignore
```

> [!CAUTION]
> `.env.prod` 파일에는 민감한 정보가 포함됩니다. 절대 Git에 커밋하지 마세요!

---

## 3. 초기 배포 절차

### 3.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              초기 배포 절차                                  │
│                                                                             │
│   Step 1: Data 서비스 시작 ────────────────────────────────────────────────▶│
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  make data-prod-up                                                   │  │
│   │  • prod-net 네트워크 생성 (Dynamic IP)                               │  │
│   │  • MySQL, Redis, MinIO 컨테이너 시작                                 │  │
│   │  • ⚠️ 이후 거의 재시작하지 않음                                       │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│   Step 2: Infrastructure 시작 ─────────────────────────────────────────────▶│
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  make infra-up                                                       │  │
│   │  • Jenkins 시작 (:8080)                                              │  │
│   │  • Nginx Proxy 시작 (:80, :443)                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│   Step 3: Application 시작 ────────────────────────────────────────────────▶│
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  make prod-app-up                                                    │  │
│   │  • WAS Blue/Green 빌드 및 시작                                       │  │
│   │  • Frontend 빌드 및 시작                                             │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│   Step 4: (선택) Monitoring 시작 ──────────────────────────────────────────▶│
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  make monitoring-up                                                  │  │
│   │  • Loki, Promtail, Grafana 시작                                      │  │
│   │  • 접속: https://도메인/grafana                                       │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 실제 명령어

```bash
# 1. 프로젝트 디렉토리로 이동
cd /home/ubuntu/project

# 2. Data 서비스 시작 (MySQL, Redis, MinIO)
make data-prod-up

# 3. DB 준비 대기 (약 30초)
sleep 30

# 4. Infrastructure 시작 (Jenkins, Nginx)
make infra-up

# 5. Application 배포 (WAS, Frontend)
make prod-app-up

# 6. (선택) Monitoring 시작
make monitoring-up

# 7. 상태 확인
make status
```

### 3.3 Jenkins 초기 설정

```bash
# Jenkins 초기 비밀번호 확인
make jenkins-password

# 브라우저에서 접속
# http://서버IP:8080
```

---

## 4. 일상 운영

### 4.1 주요 명령어

| 명령어 | 설명 | DB 영향 |
|--------|------|---------|
| `make prod-app-up` | Production App 재배포 | ❌ 없음 |
| `make prod-app-down` | Production App 중지 | ❌ 없음 |
| `make data-prod-down` | Production DB 중지 | ⚠️ 있음 |
| `make status` | 전체 서비스 상태 | - |

### 4.2 로그 확인

```bash
# Nginx 로그
make logs-nginx

# WAS Blue 로그
make logs-was-blue

# Jenkins 로그
make logs-jenkins

# 실시간 로그 (Docker 직접)
docker logs -f prod-was-blue
```

### 4.3 DB 백업

```bash
# Production DB 백업
make backup-prod
# → backup/mysql/prod_YYYYMMDD_HHMMSS.sql

# 복원
./scripts/restore-db.sh prod backup/mysql/prod_20260130_120000.sql
```

---

## 5. Blue/Green 배포

### 5.1 배포 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Blue/Green 배포 절차                               │
│                                                                             │
│   현재 상태: Blue 서비스 중                                                  │
│                                                                             │
│   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐          │
│   │   Nginx     │ ──────▶ │  WAS Blue   │         │  WAS Green  │          │
│   │   Proxy     │         │   (활성)    │         │   (대기)    │          │
│   └─────────────┘         └─────────────┘         └─────────────┘          │
│                                                                             │
│   Step 1: Green에 새 버전 배포                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  make deploy-green                                                   │  │
│   │  • Green 컨테이너에 새 이미지 배포                                   │  │
│   │  • 헬스체크 통과 대기                                                │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   Step 2: 트래픽 전환                                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  make switch-green                                                   │  │
│   │  • Nginx upstream 설정 변경                                          │  │
│   │  • Green으로 트래픽 이동                                             │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   결과: Green 서비스 중                                                      │
│   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐          │
│   │   Nginx     │         │  WAS Blue   │ ◀────── │  WAS Green  │          │
│   │   Proxy     │         │   (대기)    │         │   (활성)    │          │
│   └─────────────┘         └─────────────┘         └─────────────┘          │
│                                                                             │
│   롤백 필요시: make switch-blue                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 배포 명령어

```bash
# 1. Green에 새 버전 배포
make deploy-green

# 2. 헬스체크 확인
./scripts/health-check.sh green

# 3. 트래픽 전환
make switch-green

# 롤백이 필요한 경우
make switch-blue
```

---

---

## 6. 모니터링 시스템 (Monitoring System)

프로젝트는 **Prometheus + Grafana + Loki** 스택을 사용하여 통합 모니터링을 제공합니다.

### 6.1 아키텍처
- **Metric 수집**: 
  - **Prometheus**: 타겟(WAS, cAdvisor)으로부터 주기적으로(15s) 메트릭을 Pull 합니다.
  - **cAdvisor**: Docker 컨테이너의 CPU, Memory, Network 사용량을 수집합니다.
  - **Spring Boot Actuator**: JVM 상태(Heap, GC), DB Connection Pool, HTTP 요청 통계를 제공합니다.
- **Log 수집**:
  - **Promtail**: Docker 컨테이너 로그를 수집하고 라벨(Prod/Dev)을 부착하여 Loki로 전송합니다.
  - **Loki**: 로그 저장 및 쿼리 엔진입니다.
- **Visualization**:
  - **Grafana**: 모든 데이터(Metric + Log)를 시각화합니다.

### 6.2 접속 정보
- **URL**: `https://i14e207.p.ssafy.io/grafana/`
- **계정**: `admin` / `.env.prod`에 설정된 비밀번호

### 6.3 주요 대시보드
1. **JVM (Micrometer)**: WAS(Backend)의 상세 상태 (메모리, 스레드, DB 풀)
2. **Prometheus 2.0 Stats**: Prometheus 서버 자체 상태
3. **Docker Container Monitoring**: 전체 컨테이너 리소스 사용량 (cAdvisor 기반)
4. **Logs (Loki)**: 통합 로그 탐색기

### 6.4 문제 해결
- **Grafana 데이터가 안 보일 때**: 
  - `make infra-logs`로 Prometheus 컨테이너가 정상 동작 중인지 확인하세요.
  - 타겟 상태 확인: 포트포워딩 후 `http://localhost:9090/targets` 접속

---

## 7. 트러블슈팅

### 7.1 네트워크 오류

**증상**: `network prod-net not found`

```bash
# 해결: Data 서비스 먼저 시작
make data-prod-up
```

### 7.2 DB 연결 실패

**증상**: `Connection refused to prod-mysql`

```bash
# 1. MySQL 컨테이너 상태 확인
docker ps | grep prod-mysql

# 2. MySQL 로그 확인
docker logs prod-mysql

# 3. 헬스체크 상태 확인
docker inspect prod-mysql | grep -A 5 Health
```

### 7.3 WAS 시작 실패

**증상**: `WAS container keeps restarting`

```bash
# 1. 로그 확인
docker logs prod-was-blue

# 2. 환경 변수 확인
docker exec prod-was-blue env | grep MYSQL

# 3. DB 연결 테스트 (컨테이너 내부에서)
docker exec -it prod-was-blue curl http://prod-mysql:3306
```

### 7.4 Nginx 502 Bad Gateway

**증상**: `502 Bad Gateway`

```bash
# 1. upstream 서비스 상태 확인
docker ps | grep -E "(frontend|was)"

# 2. Nginx 설정 검증
docker exec nginx-proxy nginx -t

# 3. upstream.conf 확인
cat infra/nginx-proxy/conf.d/upstream.conf
```

### 7.5 전체 재시작 (비상시)

```bash
# ⚠️ 주의: 다운타임 발생

# 1. 모든 App 중지
make prod-app-down

# 2. Infrastructure 재시작
make infra-down
make infra-up

# 3. App 재시작
make prod-app-up

# DB 문제인 경우만
# make data-prod-down
# make data-prod-up
```

---

## 8. 레거시 명령어 호환

ADR#003 적용 이전 버전과의 호환성을 위해 레거시 명령어도 지원합니다.

### 8.1 명령어 매핑

| 레거시 명령어 | 새 명령어 | 동작 |
|--------------|----------|------|
| `make prod-up` | `make data-prod-up` + `make infra-up` + `make prod-app-up` | 전체 Production 스택 시작 |
| `make prod-down` | `make prod-app-down` | App만 중지 (DB 유지) |
| `make dev-up` | `make data-dev-up` + `make dev-app-up` | 전체 Development 스택 시작 |
| `make dev-down` | `make dev-app-down` | App만 중지 (DB 유지) |

### 8.2 주요 변경사항

> [!IMPORTANT]
> ADR#003 이후, Data(DB)와 App(WAS)이 분리되었습니다.

**변경 전 (단일 Compose)**:
```bash
docker compose up -d    # 모든 서비스 시작
docker compose down     # ⚠️ DB도 함께 중단!
```

**변경 후 (분리 Compose)**:
```bash
make data-prod-up       # Data 서비스 시작 (최초 1회)
make prod-app-up        # App 배포 (배포 때마다)
make prod-app-down      # App 중지 (DB 영향 없음 ✅)
```

### 7.3 마이그레이션 가이드

기존 단일 Compose 환경에서 마이그레이션 시:

```bash
# 1. 기존 환경 백업
make backup-prod

# 2. 기존 컨테이너 중지 (DB 데이터는 볼륨에 보존)
docker compose -f docker-compose.yml down

# 3. 새 구조로 시작
make data-prod-up       # 기존 볼륨 자동 연결
make infra-up
make prod-app-up

# 4. 정상 동작 확인
make status
```

---

## 📞 지원

문제 발생 시 다음 정보와 함께 문의:

1. `make status` 출력 결과
2. 관련 서비스 로그 (`docker logs [컨테이너명]`)
3. 발생 시간 및 상황 설명

---

*마지막 업데이트: 2026-01-30*

