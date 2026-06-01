# 웃지마게임 Frontend

React 19와 Vite 기반의 웹 클라이언트입니다. 랜덤 매칭, 초대방, 배틀 화면, OAuth 로그인, 브라우저 AI 웃음 판정, Electron 앱 사용 여부 표시와 캡처 경고 UI를 담당합니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| App | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4 |
| Routing | React Router DOM 7 |
| Server State | TanStack Query |
| Client State | Zustand |
| Realtime | OpenVidu Browser, SockJS, STOMP |
| AI Vision | MediaPipe Tasks Vision, ONNX Runtime Web |
| HTTP | Axios |

## 실행

```bash
npm install
npm run local
```

| 명령 | 설명 |
|------|------|
| `npm run local` | 로컬 백엔드(`VITE_PROXY_TARGET`)를 바라보는 Vite 개발 서버 실행 |
| `npm run dev` | 개발 서버 환경(`/dev/api`) 기준 Vite 실행 |
| `npm run build` | TypeScript 빌드 후 운영 모드 Vite 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | ESLint 검사 |

## 환경 변수

환경 파일은 `frontend/.env.local`, `frontend/.env.dev`, `frontend/.env.prod`를 사용합니다.

| 키 | 용도 |
|----|------|
| `VITE_API_URL` | Axios baseURL 및 Vite proxy prefix |
| `VITE_PROXY_TARGET` | Vite 개발 서버가 API 요청을 전달할 백엔드 주소 |
| `VITE_KAKAO_CLIENT_ID` | Kakao OAuth 클라이언트 ID |
| `VITE_NAVER_CLIENT_ID` | Naver OAuth 클라이언트 ID |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID |

## 라우팅

라우트 정의는 `src/router/index.tsx`에 있습니다.

| 경로 | 화면 | 설명 |
|------|------|------|
| `/` | `Random` | 랜딩 및 랜덤 매칭 진입 |
| `/room` | `Room` | 방 목록, 방 생성, 초대코드 입장 |
| `/match-load` | `MatchLoad` | 랜덤 매칭 대기 |
| `/room/invite` | `RoomInvite` | 초대방 생성/입장 플로우 |
| `/matching-screen/:roomId` | `MatchingScreen` | 랜덤 매칭 대기방 |
| `/room/matching/:roomId` | `MatchingScreen_friend` | 초대방 대기방 |
| `/countdown/:roomId` | `CountDown` | 배틀 시작 전 카운트다운 |
| `/battle/:roomId` | `battleScreen1` | OpenVidu, STOMP, AI 판정이 결합된 배틀 화면 |
| `/battle-result` | `battleResult` | 배틀 결과 화면 |
| `/download` | `Download` | Electron 앱 다운로드 안내 |
| `/oauth2/callback/{provider}` | `OAuthCallback` | Kakao/Naver/Google OAuth 콜백 |

## 주요 구현 포인트

### 실시간 배틀 화면

- `openvidu-browser`로 참가자 영상/음성 스트림을 연결합니다.
- SockJS/STOMP 연결은 `WebsocketLayout`에서 유지하고, 게임 이벤트는 `/publish/{roomId}`로 발행합니다.
- 배틀 화면은 웃음 판정, 항복, 신고, 포커스 이탈 상태를 서버 이벤트와 함께 처리합니다.

### 브라우저 AI 웃음 판정

- `src/services/smileDetector.ts`에서 MediaPipe Face Detector와 `onnxruntime-web`을 사용합니다.
- `smile_detector.onnx` 모델을 로드하고 5프레임 시퀀스 기반으로 웃음 확률을 계산합니다.
- EMA와 임계값으로 웃음을 확정한 뒤 배틀 화면에서 `REQUEST_LAUGHED` 이벤트를 전송합니다.

### 인증과 API 호출

- `src/lib/axios.ts`는 Access Token을 `Authorization` 헤더에 붙이고, Refresh Cookie 기반 재발급 흐름을 처리합니다.
- OAuth 신규 회원가입 단계에서는 `registerToken` 기반 요청에 Authorization 헤더를 붙이지 않습니다.
- 사용자 상태와 토큰은 `src/stores/userStore.ts`에서 관리합니다.

### Electron 앱 흐름

- `src/pages/Download.tsx`는 Electron 앱 다운로드 진입점을 제공합니다.
- 매칭/방 화면은 참가자의 Electron 앱 사용 여부를 아이콘으로 표시합니다.
- `src/hooks/useBlockCapture.ts`는 `Win+Shift+S`, `PrintScreen`, 브라우저 포커스 이탈을 감지해 경고 UI와 자동 패배 신호 흐름에 사용됩니다.

## 디렉터리 구조

```text
src/
├── assets/        # 브랜드, 아이콘, 이미지, ONNX 모델 등 정적 자산
├── components/    # 공통 UI, 레이아웃, 인증/프로필 모달, Video 컴포넌트
├── hooks/         # 모달 라우팅, 캡처 감지 등 커스텀 훅
├── lib/           # axios 인스턴스, TanStack Query 클라이언트
├── pages/         # 라우트 단위 화면
├── router/        # React Router 라우트 정의
├── services/      # 브라우저 AI 웃음 판정 서비스
├── stores/        # Zustand 상태 저장소
└── utils/         # 날짜, 배틀 결과 등 유틸 함수
```

## 관련 문서

- [루트 README](../README.md)
- [API 명세서](../docs/API_SPEC.md)
- [OpenVidu Webhook 가이드](../docs/OPENVIDU_WEBHOOK_GUIDE.md)
