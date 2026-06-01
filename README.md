<div align="center">

# 웃지마게임

<img src="frontend/src/assets/brand/wootjima-logo.png.png" width="180" alt="웃지마게임 로고" />

**미디어 스트림과 게임 이벤트를 분리하고, 브라우저 AI 웃음 판정과 Electron 검증 흐름을 결합한 실시간 웃음 참기 대결**

<br/>

![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=000000)
![TypeScript](https://img.shields.io/badge/TypeScript_5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![OpenVidu](https://img.shields.io/badge/OpenVidu_2.32-1D4ED8?style=for-the-badge)
![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime_Web-005CED?style=for-the-badge&logo=onnx&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot_3.5-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)
![Java](https://img.shields.io/badge/Java_21-437291?style=for-the-badge&logo=openjdk&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Jenkins](https://img.shields.io/badge/Jenkins-D24939?style=for-the-badge&logo=jenkins&logoColor=white)

</div>

---

## 기술 개요

'웃지마게임'은 사용자가 실시간 화상 대결에서 서로를 웃기고 웃음을 참는 서비스입니다. OpenVidu/WebRTC는 영상·음성 스트림에 집중하고, STOMP/SockJS/WebSocket은 준비, 턴 전환, 웃음 감지, 신고 같은 게임 이벤트를 별도로 동기화합니다. 브라우저에서 AI가 웃음을 확정하면 `REQUEST_LAUGHED` 이벤트가 서버로 전송되고, 서버가 턴/라운드/승패를 최종 처리합니다.

핵심은 실시간 미디어, 게임 판정, 운영 대응 흐름을 분리해 각 역할을 명확히 처리하는 것입니다.

| 흐름 | 담당 기술 | 역할 |
|------|-----------|------|
| 영상/음성 스트림 | OpenVidu, WebRTC | 참가자 간 저지연 화상 통화와 미디어 세션 연결 |
| 게임 상태 이벤트 | STOMP, SockJS, WebSocket | 준비, 시작, 턴 전환, 웃음 감지, 항복, 신고 이벤트 동기화 |
| 웃음 판정 | MediaPipe, ONNX Runtime Web, PyTorch/FastAPI | 브라우저 얼굴 탐지, 5프레임 시퀀스 기반 웃음 추론, 모델 학습/검증 |
| 방 보호와 운영 대응 | Electron, HMAC Signature, Report API, Google Sheets | Electron 전용 방 검증, 캡처 시도 경고, 신고 데이터 저장과 운영 기록 |
| 인증과 운영 안정성 | OAuth2, JWT, Redis, Jenkins, Nginx, Grafana/Loki/Promtail | 소셜 로그인, 토큰 재발급/회전, Blue/Green 배포와 로그 모니터링 |

---

## 핵심 기술 포인트

### 브라우저 기반 웃음 판정

- `@mediapipe/tasks-vision`의 Face Detector로 비디오 프레임에서 얼굴 영역을 탐지합니다.
- `onnxruntime-web` WASM 실행 환경에서 `smile_detector.onnx` 모델을 로드합니다.
- 탐지한 얼굴을 224x224 입력으로 전처리하고, 5프레임 시퀀스를 `[1, 5, 3, 224, 224]` 형태로 쌓아 추론합니다.
- 추론 결과는 EMA(`alpha=0.3`)로 보정하고, 웃음 확률이 임계값(`0.85`) 이상으로 짧은 확인 시간 동안 유지되면 웃음으로 확정합니다.
- 배틀 화면은 수비자의 웃음이 확정되면 `REQUEST_LAUGHED`를 `/publish/{roomId}`로 전송합니다.
- 서버의 `StompMessageService`는 `REQUEST_LAUGHED`를 받아 공격자 점수, 턴 전환, 라운드 종료, 최종 승패를 처리합니다.
- AI 학습/검증 자산은 `ai/smile-detection-ai`에서 관리하고, FastAPI 서버는 이미지 분석 API와 모델 설정 API를 제공합니다.

### WebRTC와 게임 이벤트 분리

- OpenVidu는 영상/음성 스트림 연결과 세션 토큰 발급 흐름을 담당합니다.
- 게임 진행 상태는 STOMP 메시지로 별도 전송해 미디어 세션과 게임 규칙 처리를 분리합니다.
- `/connect` 엔드포인트로 SockJS 연결을 열고, `/publish/{roomId}`로 클라이언트 이벤트를 발행합니다.
- 서버는 `/topic`, `/queue`, `/user` 채널로 방 전체 또는 사용자별 응답을 내려줍니다.
- WebSocket 연결 시 JWT는 `StompJwtInterceptor`에서 검증합니다.

### Electron 앱 기반 방 보호와 캡처 경고

- 다운로드 화면은 Windows용 Electron 앱 배포 경로를 제공하고, 방/매칭 화면은 참가자의 Electron 앱 사용 여부를 표시합니다.
- Electron 전용 방은 `isElectronNeeded` 옵션으로 생성되며, 서버는 `X-Signature`와 `X-Timestamp` 헤더를 HMAC-SHA256으로 검증합니다.
- 서명 검증은 타임스탬프 기준 5분 이내 요청만 허용해 재전송 위험을 줄이고, 유효하지 않으면 Electron 전용 방 생성/입장을 거부합니다.
- 배틀 화면의 `useBlockCapture`는 `Win+Shift+S`, `PrintScreen`, 포커스 이탈을 감지해 경고 모달과 화면 가림을 표시합니다.
- 포커스가 일정 시간 안에 돌아오지 않으면 클라이언트가 `REQUEST_SURRENDER`를 전송해 게임 규칙 안에서 패배 처리로 이어집니다.

### 신고와 악성 유저 대응

- 배틀 화면의 신고 모달은 상대 닉네임, 사유, 상세 내용을 `POST /reports`로 전송합니다.
- `ReportService`는 신고 대상 존재 여부와 자기 자신 신고를 검증하고, 신고 데이터를 DB에 저장합니다.
- 신고 저장 후 `GoogleSheetsService`가 운영 확인용 Google Sheets에 한 줄을 추가하며, Sheets 기록 실패는 신고 접수 자체를 막지 않습니다.
- 신고 접수 후 클라이언트는 `REQUEST_REPORT` STOMP 이벤트를 발행하고, 서버는 `RESPONSE_REPORTED`로 방 참가자에게 신고 결과를 알립니다.

### OAuth와 JWT 인증 보안

- Kakao, Naver, Google OAuth 인가/콜백 흐름을 제공하고, 신규 사용자는 `registerToken`으로 회원가입 단계로 이어집니다.
- 회원가입 API는 `registerToken`에서 소셜 ID와 provider를 검증한 뒤 닉네임 정책과 중복 가입을 확인합니다.
- 로그인/회원가입 성공 시 Access Token과 Refresh Token을 발급하고, 서버는 Refresh Token을 HttpOnly Cookie로 설정합니다.
- Refresh Token은 Redis에 저장된 값과 비교하며, 재발급 시 새 토큰으로 회전해 기존 토큰 재사용을 막습니다.
- Access Token 만료 시 `JwtAuthenticationFilter`와 프론트엔드 axios 인터셉터가 Refresh Cookie 기반 Silent Refresh 흐름을 수행합니다.

### 상태 저장 계층 분리

- MySQL은 사용자, 방, 게임 결과 등 영속 데이터를 저장합니다.
- Redis는 Refresh Token과 빠른 조회가 필요한 인증 상태를 관리합니다.
- MinIO는 프로필 이미지 등 오브젝트 파일을 저장하고 Presigned URL 업로드 흐름을 제공합니다.
- 운영 환경에서는 Data(Stateful)와 App(Stateless)을 Docker Compose 레벨에서 분리해 앱 배포가 DB 계층에 영향을 주지 않도록 구성했습니다.

### 배포와 운영

- Jenkins 파이프라인으로 빌드와 배포를 자동화합니다.
- Nginx Reverse Proxy가 프론트엔드, 백엔드, MinIO, Jenkins, OpenVidu Webhook 외부 엔드포인트(`/api/webhook`)를 중계합니다.
- WAS는 Blue/Green 배포 구조로 운영하고, 새 인스턴스 헬스체크 이후 트래픽을 전환해 배포 중단 시간을 줄입니다.
- Grafana, Loki, Promtail 기반 PLG 스택으로 컨테이너 로그와 운영 상태를 확인합니다.
- Data(Stateful)와 App(Stateless) 스택을 분리해 앱 배포가 MySQL, Redis, MinIO 계층에 주는 영향을 낮춥니다.

---

## 주요 기능

<table>
  <tr>
    <td align="center" valign="top" width="25%">
      <a href="docs/demo/videos/random-match.mp4">
        <img src="docs/demo/thumbs/random-match.png" alt="랜덤 매칭 배틀 시연 썸네일" width="100%" />
      </a>
      <br />
      <a href="docs/demo/videos/random-match.mp4">
        <img src="https://img.shields.io/badge/%E2%96%B6%20%EC%98%81%EC%83%81%20%EB%B3%B4%EA%B8%B0-444444?style=flat-square" alt="영상 보기" />
      </a>
      <br /><br />
      <strong>랜덤 매칭 배틀</strong>
      <p>랜덤 매칭 후 OpenVidu 화상 세션과 STOMP 게임 이벤트로 실시간 대결을 진행합니다.</p>
    </td>
    <td align="center" valign="top" width="25%">
      <a href="docs/demo/videos/invite-battle.mp4">
        <img src="docs/demo/thumbs/invite-battle.png" alt="초대 배틀 시연 썸네일" width="100%" />
      </a>
      <br />
      <a href="docs/demo/videos/invite-battle.mp4">
        <img src="https://img.shields.io/badge/%E2%96%B6%20%EC%98%81%EC%83%81%20%EB%B3%B4%EA%B8%B0-444444?style=flat-square" alt="영상 보기" />
      </a>
      <br /><br />
      <strong>초대 배틀</strong>
      <p>초대방으로 상대를 초대하고 준비/시작 흐름을 거쳐 배틀에 진입합니다.</p>
    </td>
    <td align="center" valign="top" width="25%">
      <a href="docs/demo/videos/report.mp4">
        <img src="docs/demo/thumbs/report.png" alt="신고 기능 시연 썸네일" width="100%" />
      </a>
      <br />
      <a href="docs/demo/videos/report.mp4">
        <img src="https://img.shields.io/badge/%E2%96%B6%20%EC%98%81%EC%83%81%20%EB%B3%B4%EA%B8%B0-444444?style=flat-square" alt="영상 보기" />
      </a>
      <br /><br />
      <strong>신고 기능</strong>
      <p>신고 모달에서 사유를 접수하고 API 저장 및 STOMP 신고 이벤트로 대응합니다.</p>
    </td>
    <td align="center" valign="top" width="25%">
      <a href="docs/demo/videos/capture-guard.mp4">
        <img src="docs/demo/thumbs/capture-guard.png" alt="창 이탈 감지 시연 썸네일" width="100%" />
      </a>
      <br />
      <a href="docs/demo/videos/capture-guard.mp4">
        <img src="https://img.shields.io/badge/%E2%96%B6%20%EC%98%81%EC%83%81%20%EB%B3%B4%EA%B8%B0-444444?style=flat-square" alt="영상 보기" />
      </a>
      <br /><br />
      <strong>창 이탈 감지</strong>
      <p>배틀 중 포커스 이탈을 감지해 화면 가림과 경고 흐름을 제공합니다.</p>
    </td>
  </tr>
</table>

---

## 시스템 아키텍처

<p align="center">
  <img src="docs/img/wootjima-architecture.png" alt="웃지마게임 시스템 아키텍처" width="100%" />
</p>

| 영역 | 구성 | 역할 |
|------|------|------|
| Client | Browser, Electron App | React 앱 접속, Electron 전용 방 서명 헤더 전달, OpenVidu/STOMP 연결 |
| Edge | Nginx Reverse Proxy | `/api`, `/dev`, `/objects`, `/grafana`, `/api/webhook` 등 외부 진입 경로 중계 |
| Prod-Net | Prod-Frontend, WAS Blue/Green, MySQL, Redis, MinIO | 운영 서비스 실행, Blue/Green WAS 트래픽 전환, 사용자·게임 데이터와 이미지 저장 |
| Dev-Net | Dev-Frontend, Dev-WAS, MySQL, Redis, MinIO | 개발/검증 환경 실행, 운영과 분리된 API·정적 앱·데이터 스택 제공 |
| Realtime Media | OpenVidu, Kurento Media Server, Coturn, OpenVidu Redis | WebRTC 미디어 세션, TURN/STUN, OpenVidu 세션 상태 관리 |
| CI/CD | SSAFY GitLab, Jenkins, Mattermost | 브랜치 머지 기준 배포 파이프라인 실행, 배포 결과 알림 전송 |
| Monitoring-Net | Promtail, Loki, Grafana, Prometheus, cAdvisor | 컨테이너 로그 수집·조회, 메트릭 스크래핑, 운영 대시보드 제공 |

---

## 기술 스택

<table>
  <tr>
    <th align="center" width="20%">Category</th>
    <th align="center">Stack</th>
  </tr>
  <tr>
    <td align="center"><strong>Frontend</strong></td>
    <td>
      <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=000000" />
      <img src="https://img.shields.io/badge/TypeScript_5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
      <img src="https://img.shields.io/badge/Vite_7-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
      <img src="https://img.shields.io/badge/TailwindCSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
      <img src="https://img.shields.io/badge/Zustand-2D3748?style=for-the-badge" />
      <img src="https://img.shields.io/badge/TanStack_Query_5-FF4154?style=for-the-badge&logo=reactquery&logoColor=white" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Realtime</strong></td>
    <td>
      <img src="https://img.shields.io/badge/OpenVidu_2.32-1D4ED8?style=for-the-badge" />
      <img src="https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white" />
      <img src="https://img.shields.io/badge/STOMP-6B7280?style=for-the-badge" />
      <img src="https://img.shields.io/badge/SockJS-4B5563?style=for-the-badge" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>AI / Vision</strong></td>
    <td>
      <img src="https://img.shields.io/badge/MediaPipe-0097A7?style=for-the-badge" />
      <img src="https://img.shields.io/badge/ONNX_Runtime_Web-005CED?style=for-the-badge&logo=onnx&logoColor=white" />
      <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" />
      <img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white" />
      <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
      <img src="https://img.shields.io/badge/MLflow-0194E2?style=for-the-badge&logo=mlflow&logoColor=white" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Backend</strong></td>
    <td>
      <img src="https://img.shields.io/badge/Java_21-437291?style=for-the-badge&logo=openjdk&logoColor=white" />
      <img src="https://img.shields.io/badge/Spring_Boot_3.5-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" />
      <img src="https://img.shields.io/badge/Spring_Security-3A8D3A?style=for-the-badge&logo=springsecurity&logoColor=white" />
      <img src="https://img.shields.io/badge/JPA-59666C?style=for-the-badge" />
      <img src="https://img.shields.io/badge/SpringDoc_OpenAPI-6BA539?style=for-the-badge" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Data</strong></td>
    <td>
      <img src="https://img.shields.io/badge/MySQL_8-4479A1?style=for-the-badge&logo=mysql&logoColor=white" />
      <img src="https://img.shields.io/badge/Redis-D82C20?style=for-the-badge&logo=redis&logoColor=white" />
      <img src="https://img.shields.io/badge/MinIO-C72E49?style=for-the-badge&logo=minio&logoColor=white" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Infra</strong></td>
    <td>
      <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
      <img src="https://img.shields.io/badge/Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
      <img src="https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white" />
      <img src="https://img.shields.io/badge/Jenkins-D24939?style=for-the-badge&logo=jenkins&logoColor=white" />
      <img src="https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white" />
      <img src="https://img.shields.io/badge/Loki-7C3AED?style=for-the-badge" />
    </td>
  </tr>
</table>

---

## 모듈별 역할

| 모듈 | 주요 역할 | 기술 키워드 |
|------|-----------|-------------|
| `frontend/` | 웹 클라이언트, OAuth 흐름, 매칭/방/대결 화면, OpenVidu 연결, 브라우저 웃음 감지, 캡처 경고 UI | React, TypeScript, Vite, Zustand, React Query, OpenVidu, ONNX Runtime Web |
| `backend/` | 인증, 사용자, 방 관리, 매칭, 게임 이벤트 처리, OpenVidu 토큰 발급, Electron 서명 검증, 신고 저장 | Java 21, Spring Boot, Spring Security, JPA, Redis, STOMP |
| `ai/smile-detection-ai/` | 웃음 감지 모델 학습/파인튜닝, ONNX export, FastAPI 분석 서버, 실험 리포트 | PyTorch, MediaPipe, OpenCV, FastAPI, MLflow, ONNX |
| `infra/` | Jenkins, Nginx, 데이터 서비스, 모니터링, 운영 네트워크 구성 | Docker Compose, Jenkins, Nginx, MySQL, Redis, MinIO, Grafana |
| `docs/` | API 명세, 기술 조사, 의사결정 자료, 시연/회고 산출물 | API Spec, WebRTC 조사, 하이라이트 저장 방식 |
| `exec/` | 제출 및 포팅 산출물 | Porting, Deployment |

---

## 주요 API와 이벤트

| 영역 | 엔드포인트/채널 | 설명 |
|------|----------------|------|
| Auth | `/auth/login`, `/auth/regist`, `/auth/refresh`, `/oauth2/**` | OAuth 로그인, registerToken 기반 회원가입, JWT 재발급/회전 |
| User | `/user`, `/user/check/nickname`, `/user/upload/profileImage` | 사용자 정보, 닉네임 검사, 프로필 이미지 업로드 |
| Room | `/room/list`, `/room/create`, `/room/join`, `/room/join-by-code` | 방 목록, 방 생성, 일반/초대 입장 |
| Match | `/matchmaking/start`, `/matchmaking/cancel` | 랜덤 매칭 시작/취소 |
| Report | `/reports` | 신고 접수, DB 저장, Google Sheets 운영 기록 |
| Electron | `/is-electron`, `X-Signature`, `X-Timestamp` | Electron 앱 여부 확인과 Electron 전용 방 검증 |
| WebSocket | `/connect`, `/publish/{roomId}`, `/topic/**`, `/user/queue/**` | 준비, 시작, 턴 전환, `REQUEST_LAUGHED`, 항복, `REQUEST_REPORT` 이벤트 |
| OpenVidu Webhook | `/api/webhook` | OpenVidu 세션 이벤트 수신 및 방 상태 반영 |

---

## 저장소 구조

```text
.
├── ai/
│   └── smile-detection-ai/       # 웃음 감지 모델, 학습 스크립트, FastAPI 서버
├── backend/                      # Spring Boot API 서버
│   ├── src/main/java/ssafy/E207/
│   │   ├── domain/               # auth, user, match, game
│   │   └── global/               # config, jwt, error, logging
│   └── docker-compose.*.yml
├── frontend/                     # React 웹 클라이언트
│   ├── src/components/           # 공통 UI, Video, SmileCam
│   ├── src/pages/                # 매칭, 방, 배틀, OAuth 화면
│   ├── src/services/             # smileDetector
│   ├── src/hooks/                # 캡처 감지 등 커스텀 훅
│   ├── src/stores/               # Zustand 상태
│   └── src/lib/                  # axios, queryClient
├── infra/                        # Jenkins, Nginx, DB/Redis/MinIO, monitoring
├── docs/                         # API/기술조사/설계/시연 자료
├── exec/                         # 제출 및 포팅 문서
├── scripts/                      # 배포 보조 스크립트
├── Makefile                      # 로컬/개발/운영 실행 진입점
├── DOCKER_GUIDE.md               # Docker Compose 환경별 가이드
└── DEPLOYMENT_GUIDE.md           # Blue/Green 배포 및 운영 가이드
```

---

## 실행 가이드

### 사전 요구사항

- Docker & Docker Compose
- Node.js 18+
- JDK 21
- Python 3.10+ (AI 서버 또는 학습 실행 시)

### 로컬 백엔드/데이터 스택 실행

```bash
make local-up
```

| 서비스 | URL |
|--------|-----|
| Backend API | http://localhost:8081 |
| Swagger UI | http://localhost:8081/swagger-ui/index.html |
| MySQL | localhost:3307 |
| Redis | localhost:6380 |
| MinIO Console | http://localhost:9001 |

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run local
```

### AI API 서버 실행

```bash
cd ai/smile-detection-ai
pip install -r requirements.txt
uvicorn api.main:app --reload
```

### 로컬 스택 중지

```bash
make local-down
```

---

## 문서 바로가기

### Overview

| 문서 | 경로 |
|------|------|
| Frontend README | [frontend/README.md](frontend/README.md) |
| Backend README | [backend/README.md](backend/README.md) |
| Infra README | [infra/README.md](infra/README.md) |
| Docker Guide | [DOCKER_GUIDE.md](DOCKER_GUIDE.md) |
| Deployment Guide | [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) |

### Architecture / API

| 문서 | 경로 |
|------|------|
| API 명세서 | [docs/API_SPEC.md](docs/API_SPEC.md) |
| OpenVidu Webhook 가이드 | [docs/OPENVIDU_WEBHOOK_GUIDE.md](docs/OPENVIDU_WEBHOOK_GUIDE.md) |
| 실시간 통신 기술 조사 | [docs/오언서/조사_분석/실시간통신기술조사/실시간통신기술.md](docs/오언서/조사_분석/실시간통신기술조사/실시간통신기술.md) |
| 하이라이트 저장 방식 검토 | [docs/오언서/기술_구현/하이라이트저장방식/하이라이트저장방식.md](docs/오언서/기술_구현/하이라이트저장방식/하이라이트저장방식.md) |

### AI

| 문서 | 경로 |
|------|------|
| AI 프로젝트 구조 | [ai/smile-detection-ai/docs/PROJECT_STRUCTURE.md](ai/smile-detection-ai/docs/PROJECT_STRUCTURE.md) |
| 30 Epochs Fine-tuning 실험 | [ai/smile-detection-ai/docs/finetuning_experiments/experiment_02_30epochs/README.md](ai/smile-detection-ai/docs/finetuning_experiments/experiment_02_30epochs/README.md) |
| AI 포트폴리오 요약 | [ai/smile-detection-ai/docs/PORTFOLIO_양한빈.md](ai/smile-detection-ai/docs/PORTFOLIO_양한빈.md) |

---

## 팀 소개 — 웃지마게임

<table>
  <tr>
    <td align="center" width="14%">
      <strong>김승철</strong><br/>
      <sub>팀원</sub><br/><br/>
      <img src="https://img.shields.io/badge/Frontend-2F80ED?style=flat-square&logo=react&logoColor=white" alt="Frontend" /><br/>
      <img src="https://img.shields.io/badge/WebRTC-333333?style=flat-square&logo=webrtc&logoColor=white" alt="WebRTC" /><br/>
      <sub>OpenVidu 클라이언트</sub><br/>
      <sub>Battle UI</sub>
    </td>
    <td align="center" width="14%">
      <strong>박세홍</strong><br/>
      <sub>팀원</sub><br/><br/>
      <img src="https://img.shields.io/badge/Frontend-2F80ED?style=flat-square&logo=react&logoColor=white" alt="Frontend" /><br/>
      <img src="https://img.shields.io/badge/Battle_UI-7C3AED?style=flat-square" alt="Battle UI" /><br/>
      <sub>배틀 화면</sub><br/>
      <sub>AI 판정 연동</sub>
    </td>
    <td align="center" width="14%">
      <strong>양한빈</strong><br/>
      <sub>팀원</sub><br/><br/>
      <img src="https://img.shields.io/badge/AI-2F6F9F?style=flat-square&logo=onnx&logoColor=white" alt="AI" /><br/>
      <img src="https://img.shields.io/badge/ONNX-005CED?style=flat-square&logo=onnx&logoColor=white" alt="ONNX" /><br/>
      <sub>웃음 감지 모델</sub><br/>
      <sub>FastAPI</sub>
    </td>
    <td align="center" width="14%">
      <strong>오언서</strong><br/>
      <sub>팀원</sub><br/><br/>
      <img src="https://img.shields.io/badge/Backend-4C9A2A?style=flat-square&logo=springboot&logoColor=white" alt="Backend" /><br/>
      <img src="https://img.shields.io/badge/Report-EA580C?style=flat-square" alt="Report" /><br/>
      <sub>신고 API</sub><br/>
      <sub>Google Sheets</sub>
    </td>
    <td align="center" width="14%">
      <strong>유준호</strong><br/>
      <sub>팀원</sub><br/><br/>
      <img src="https://img.shields.io/badge/Backend-4C9A2A?style=flat-square&logo=springboot&logoColor=white" alt="Backend" /><br/>
      <img src="https://img.shields.io/badge/Infra-F59E0B?style=flat-square&logo=docker&logoColor=white" alt="Infra" /><br/>
      <sub>배포 자동화</sub><br/>
      <sub>Monitoring</sub>
    </td>
    <td align="center" width="14%">
      <strong>이재호</strong><br/>
      <sub>팀장</sub><br/><br/>
      <img src="https://img.shields.io/badge/PM-555555?style=flat-square" alt="PM" /><br/>
      <img src="https://img.shields.io/badge/Frontend-2F80ED?style=flat-square&logo=react&logoColor=white" alt="Frontend" /><br/>
      <img src="https://img.shields.io/badge/Docs-2F6F9F?style=flat-square&logo=markdown&logoColor=white" alt="Docs" /><br/>
      <sub>기획/일정 관리</sub><br/>
      <sub>문서·시연</sub>
    </td>
    <td align="center" width="14%">
      <strong>차경빈</strong><br/>
      <sub>팀원</sub><br/><br/>
      <img src="https://img.shields.io/badge/Backend-4C9A2A?style=flat-square&logo=springboot&logoColor=white" alt="Backend" /><br/>
      <img src="https://img.shields.io/badge/Match-2563EB?style=flat-square" alt="Match" /><br/>
      <sub>방/매칭 도메인</sub><br/>
      <sub>STOMP</sub>
    </td>
  </tr>
</table>

---

## License

This project is for SSAFY educational purposes.
