# 🍃 Backend Developer Guide

Smile Battle 프로젝트의 백엔드 개발자 가이드입니다.
이 문서는 백엔드 애플리케이션의 설정, 실행, 기술 스택, 그리고 배포 전략을 다룹니다.

---

## 🛠️ 기술 스택 (Tech Stack)

### Core
- **Language**: Java 21 (Temurin / OpenJDK)
- **Framework**: Spring Boot 3.5.9
- **Build Tool**: Gradle (Groovy)

### Database & Storage
- **RDBMS**: MySQL 8.0 (JPA / Hibernate)
- **Cache**: Redis (Spring Data Redis)
- **Object Storage**: MinIO (AWS S3 Compatible)

### Infrastructure & Deploy
- **Docker**: Docker Compose based (Infra/App separation)
- **CI/CD**: Jenkins, Blue/Green Deployment
- **Monitoring**: Grafana, Loki, Promtail (PLG Stack)
- **WebRTC**: OpenVidu 2.30.0+

### Key Libraries
- **Security**: Spring Security + JWT (jjwt 0.11.5)
- **API Docs**: Swagger UI (springdoc-openapi 2.8.6)
- **Env Mgmt**: java-dotenv 3.0.0
- **Utils**: json-simple, Lombok

---

## 🚀 로컬 개발 환경 설정 (Getting Started)

### 1. 사전 요구사항
- JDK 21 설치
- IntelliJ IDEA (Lombok Plugin)
- Docker Desktop 실행 중

### 2. 환경변수 설정
백엔드 루트 디렉토리의 `.env.example`을 복사하여 `.env`를 생성합니다.

```bash
cd backend
cp .env.example .env
# .env 파일을 열어 DB 비밀번호, API Key 등을 본인 환경에 맞게 수정
```

### 3. 로컬 실행 (Docker 사용 권장)
DB, Redis, MinIO, WAS를 한 번에 실행합니다.

```bash
# 프로젝트 루트에서
make local-up
```
- API 서버: http://localhost:8081
- Swagger UI: http://localhost:8081/swagger-ui/index.html
- MinIO Console: http://localhost:9001 (admin/admin123)

### 4. 로컬 실행 (IntelliJ 사용 시)
데이터베이스만 Docker로 띄우고, Spring Boot는 IDE에서 실행할 수 있습니다.

```bash
# 1. DB 서비스 스택만 실행 (prod-net과 dev-net 네트워크 생성됨)
make data-dev-up

# 2. IntelliJ에서 BackendApplication.java 실행
# (Active Profile: local로 설정 확인)
```

---

## 🏗️ 아키텍처 및 패키지 구조

도메인형 디렉토리 구조를 따릅니다.

```
backend/src/main/java/com/ssafy/smilebattle
├── common/              # 공통 유틸리티, 설정, 예외 처리
│   ├── config/          # Spring Config (Security, Swagger, WebMvc...)
│   ├── exception/       # Global Exception Handler
│   └── util/            # JWT Util, File Util 등
├── domain/              # 비즈니스 도메인 (기능별 분리)
│   ├── user/            # 회원 가입, 로그인, 프로필
│   ├── game/            # 게임 로직, WebRTC 시그널링
│   ├── room/            # 대기방 관리
│   └── smile/           # 웃음 감지 AI 연동
└── infra/               # 외부 시스템 연동 (MinIO, OpenVidu)
```

---

## 🔄 배포 및 운영 (Deployment)

본 프로젝트는 **Infra(Stateful)와 App(Stateless)을 분리**하여 관리합니다.

### 명령어 요약
| 목적 | 명령어 | 설명 |
|---|---|---|
| **개발 서버 배포** | `make dev-app-up` | AWS 개발 서버에 WAS 배포 |
| **운영 서버 배포** | `make prod-app-up` | 운영 서버(Blue/Green) 배포 |
| **로그 확인** | `make logs-was-blue` | 운영 서버 WAS 로그 확인 |

자세한 배포 전략은 [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)를 참고하세요.

### Blue/Green 배포 원리
1. Jenkins가 현재 `Idle` 상태의 컬러(예: Green)를 판단
2. Green 컨테이너에 신규 버전 배포
3. Health Check 통과 시 Nginx Upstream 변경 (`switch-upstream.sh`)
4. 트래픽 전환 완료 및 Mattermost 알림

---

## 🔍 API 문서 (Swagger)

서버 실행 후 아래 주소에서 API 명세를 확인할 수 있습니다.

- **Local**: `http://localhost:8081/swagger-ui/index.html`
- **Dev**: `https://dev-api.도메인/swagger-ui/index.html`
- **Prod**: `https://api.도메인/swagger-ui/index.html` (접근 제한될 수 있음)

---

## 🧪 테스트 (Testing)

```bash
# 전체 테스트 실행
./gradlew test

# 특정 테스트 제외하고 빌드
./gradlew build -x test
```

---

## 🤝 Contribution

1. `develop` 브랜치에서 기능별 브랜치(`feat/login`) 생성
2. 작업 완료 후 PR 생성
3. Jenkins CI 빌드 통과 확인
4. 코드 리뷰 후 Merge
