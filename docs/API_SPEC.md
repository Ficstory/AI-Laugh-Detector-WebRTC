# 웃지마게임 백엔드 API 명세서

웃지마게임 프로젝트의 백엔드 API 명세서입니다.

## 목차

1. [인증 (Auth)](#1-인증-auth)
2. [사용자 (User)](#2-사용자-user)
3. [방 관리 (Room)](#3-방-관리-room)
4. [매칭 (Match)](#4-매칭-match)
5. [웹소켓 (WebSocket)](#5-웹소켓-websocket)

---

## 공통 응답 코드

| 코드 | 설명 |
|------|------|
| 200 | 요청 정상처리 |
| 400 | 클라이언트 오류 |
| 401 | 인증 실패 / 유효하지 않은 토큰 |
| 404 | 리소스를 찾을 수 없음 |
| 409 | 중복 데이터 |
| 429 | 과도한 API 호출 |
| 500 | 서버 오류 |
| 503 | 서비스 불가 (서버 과부하/유지보수) |

---

## 1. 인증 (Auth)

### 1.1 OAuth 로그인

소셜 로그인 API

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/auth/login` |
| 인증 | Request Body |

**Request Body**
```json
{
  "oauthProvider": "NAVER",  // KAKAO, NAVER, GOOGLE
  "authorizationCode": "소셜 로그인 성공 후 redirect로 받은 code 값",
  "redirectUri": "해당 플랫폼 리다이렉트 URI"
}
```

**Response (200) - 로그인 성공**
```json
{
  "code": 200,
  "message": "로그인 성공",
  "data": {
    "accessToken": "string",
    "refreshToken": "string",
    "user": {
      "id": "UUID",
      "nickname": "카카오닉네임",
      "profileImageUrl": "https://kakao.com/profile.jpg"
    }
  }
}
```

**Response (404) - 회원가입 필요**
```json
{
  "code": 404,
  "message": "회원가입이 필요합니다.",
  "data": {
    "registerToken": "eyJhbGciOiJIUzI1NiJ9..."
  }
}
```

---

### 1.2 회원가입

소셜 정보를 활용한 회원가입

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/auth/regist` |
| 인증 | Request Body |

**Request Body**
```json
{
  "registerToken": "소셜로그인 API에서 받은 registerToken값",
  "nickname": "사용자 닉네임",
  "profileImage": "S3에 업로드한 사용자 프로필이미지 URL (null 가능)",
  "isMarketing": true
}
```

**Response (201)**
```json
{
  "code": 201,
  "message": "회원가입 성공",
  "data": {
    "accessToken": "string",
    "refreshToken": "string",
    "user": {
      "id": "UUID",
      "email": "user@kakao.com",
      "nickname": "카카오닉네임",
      "profileImageUrl": "https://kakao.com/profile.jpg"
    },
    "isNewUser": true
  }
}
```

---

### 1.3 로그아웃

JWT 토큰을 Redis 블랙리스트에 추가하여 로그아웃 처리

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/auth/logout` |
| 인증 | Bearer Token |

**Request Header**
```
Authorization: Bearer {accessToken}
```

**Response (200)**
```json
{
  "code": 200,
  "message": "로그아웃되었습니다."
}
```

---

### 1.4 토큰 재발급

Access 토큰 만료 시 Refresh 토큰으로 재발급

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/auth/refresh` |
| 인증 | Bearer Token + Request Body |

**Request Header**
```
Authorization: Bearer {accessToken}
```

**Request Body**
```json
{
  "refreshToken": "string"
}
```

**Response (200)**
```json
{
  "code": 200,
  "message": "토큰 재발급 성공",
  "data": {
    "accessToken": "string",
    "refreshToken": "string"
  }
}
```

---

### 1.5 회원탈퇴

사용자 계정 소프트 삭제 (deleted_at 설정)

| 항목 | 내용 |
|------|------|
| Method | `DELETE` |
| URL | `/auth/delete` |
| 인증 | Bearer Token |

**Response (200)**
```json
{
  "code": 200,
  "message": "회원 탈퇴가 정상적으로 처리되었습니다."
}
```

---

## 2. 사용자 (User)

### 2.1 닉네임 중복 체크

회원가입 시 닉네임 중복 여부 확인

| 항목 | 내용 |
|------|------|
| Method | `GET` |
| URL | `/user/check/nickname?nickname={nickname}` |
| 인증 | 없음 |

**Response (200) - 사용 가능**
```json
{
  "code": 200,
  "message": "사용 가능한 닉네임입니다."
}
```

**Response (409) - 중복**
```json
{
  "code": 409,
  "message": "이미 사용 중인 닉네임입니다."
}
```

---

### 2.2 내 정보 조회

로그인한 사용자의 정보 조회

| 항목 | 내용 |
|------|------|
| Method | `GET` |
| URL | `/user` |
| 인증 | Bearer Token |

**Response (200)**
```json
{
  "code": 200,
  "message": "사용자 정보 조회 성공",
  "data": {
    "id": "UUID",
    "nickname": "닉네임",
    "profileImageUrl": "https://example.com/profile.jpg",
    "isMarketing": true,
    "totalGames": 13,
    "totalWins": 6,
    "totalDraws": 2,
    "totalLosses": 5,
    "currentWinStreak": 2,
    "maxWinStreak": 4,
    "recentResults": ["W", "W", "W", "L", "D"]
  }
}
```

---

### 2.3 개인정보 수정

닉네임, 마케팅 수신동의 등 수정

| 항목 | 내용 |
|------|------|
| Method | `PATCH` |
| URL | `/user/change` |
| 인증 | Bearer Token + Request Body |

**Request Body**
```json
{
  "nickname": "새로운닉네임",
  "isMarketing": true
}
```

**Response (200)**
```json
{
  "code": 200,
  "message": "정보 수정 성공",
  "data": {
    "user": {
      "id": "UUID",
      "nickname": "새로운닉네임",
      "profileImageUrl": "https://example.com/new-profile.jpg",
      "isMarketing": true
    }
  }
}
```

---

### 2.4 마케팅 수신동의 변경

| 항목 | 내용 |
|------|------|
| Method | `PATCH` |
| URL | `/user/change/marketing` |
| 인증 | Bearer Token + Request Body |

**Request Body**
```json
{
  "isMarketing": false
}
```

**Response (200)**
```json
{
  "code": 200,
  "message": "마케팅 수신 동의 변경 성공"
}
```

---

### 2.5 유저 프로필 이미지 등록

프로필 이미지 업로드 URL 요청

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/user/upload/profileImage` |
| 인증 | Bearer Token (회원) / registerToken (비회원) |

**Request Body (회원가입 전)**
```json
{
  "contentType": "image/png",
  "fileSize": 183920,
  "originalFileName": "profile.png",
  "registerToken": "소셜로그인 후 받은 RegisterToken"
}
```

**Request Body (회원가입 후)**
```json
{
  "contentType": "image/png",
  "fileSize": 183920,
  "originalFileName": "profile.png"
}
```

**Response (200)**
```json
{
  "code": 200,
  "message": "유저 프로필 이미지 설정 URL 제공완료",
  "data": {
    "uploadUrl": "https://minio.example.com/...",
    "objectKey": "profile/2026/01/uuid.png"
  }
}
```

---

### 2.6 유저 프로필 이미지 컨펌

업로드 완료 후 프로필 이미지 확정

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/user/confirm/profileImage` |
| 인증 | Bearer Token (회원) / registerToken (비회원) |

**Request Body**
```json
{
  "objectKey": "profile/{userId}/2026/01/{uuid}.png",
  "registerToken": "..." // 회원가입 시에만
}
```

**Response (200)**
```json
{
  "code": 200,
  "message": "프로필 이미지가 저장되었습니다.",
  "data": {
    "profileImageUrl": "profile/{userId}/2026/01/{uuid}.png"
  }
}
```

---

### 2.7 유저 프로필 이미지 삭제

| 항목 | 내용 |
|------|------|
| Method | `DELETE` |
| URL | `/user/delete/profileImage` |
| 인증 | Bearer Token (회원) / registerToken (비회원) |

**Request Body**
```json
{
  "objectKey": "profile/{userId}/2026/01/{uuid}.png",
  "registerToken": "..." // 회원가입 시에만
}
```

**Response (200)**
```json
{
  "code": 200,
  "message": "프로필 이미지가 삭제되었습니다.",
  "data": {
    "profileImageUrl": "profile/{userId}/2026/01/{uuid}.png"
  }
}
```

---

## 3. 방 관리 (Room)

### 3.1 방 목록 조회

현재 생성되어 있는 방 목록 조회 (페이징 지원)

| 항목 | 내용 |
|------|------|
| Method | `GET` |
| URL | `/room/list?page={page}&size={size}` |
| 인증 | Bearer Token |

**Response (200)**
```json
{
  "code": 200,
  "message": "방 목록 조회 성공",
  "data": {
    "content": [
      {
        "id": 26,
        "name": "방 제목",
        "hostNickname": "hong gildong2",
        "status": "WAITING",
        "participantCount": 1,
        "createdTime": "2026-01-25T17:59:14.907046",
        "private": true
      }
    ],
    "pageable": {
      "pageNumber": 0,
      "pageSize": 5,
      "sort": { "empty": false, "unsorted": false, "sorted": true },
      "offset": 0,
      "unpaged": false,
      "paged": true
    },
    "last": true,
    "totalElements": 2,
    "totalPages": 1,
    "size": 5,
    "number": 0,
    "first": true,
    "numberOfElements": 2,
    "empty": false
  }
}
```

**Room Status**
- `WAITING`: 대기 중
- `PLAYING`: 게임 진행 중
- `TERMINATED`: 종료된 게임 방

---

### 3.2 방 생성

새로운 게임 방 생성

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/room/create` |
| 인증 | Bearer Token + Request Body |

**Request Body**
```json
{
  "name": "방 제목",
  "password": "",
  "isElectronNeeded": true
}
```

**Response (200)**
```json
{
  "code": 200,
  "message": "방 개설 성공",
  "data": {
    "id": 28,
    "name": "123",
    "token": "ws://localhost:4443?sessionId=28&token=tok_YfFcQjnXg3oRrdLz"
  }
}
```

---

### 3.3 방 입장

게임 방 입장

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/room/join` |
| 인증 | Bearer Token + Request Body |

**Request Body**
```json
{
  "id": "3",
  "password": ""
}
```

**Response (200)**
```json
{
  "code": 200,
  "message": "방 참여 성공",
  "data": {
    "id": 18,
    "name": "123",
    "token": "ws://localhost:4443?sessionId=18&token=tok_XI2W46CubnzkLm7t",
    "participants": [
      {
        "userId": "c0a81eac-9c02-14a5-819c-0294c6400001",
        "nickname": "hong gildong2",
        "ready": true,
        "host": true
      },
      {
        "userId": "c0a81eac-9c02-14a5-819c-0294c5e90000",
        "nickname": "hong gildong",
        "ready": false,
        "host": false
      }
    ]
  }
}
```

**에러 응답**
- `400`: 사용자를 찾을 수 없습니다.
- `400`: 존재하지 않는 방입니다.
- `400`: 방이 꽉 찼습니다.
- `400`: 현재 방에 들어가려면 일렉트론 앱이 필요합니다.
- `400`: 비밀번호가 틀렸습니다.

---

### 3.4 방 퇴장

방에서 퇴장 (별도 API 없음)

- OpenVidu session disconnect
- 웹소켓 추가 경로 구독 해제

위 동작을 수행하면 자동으로 퇴장 처리됩니다.
참가 인원이 0명이 될 때 방은 자동으로 삭제됩니다.

---

### 3.5 친구 초대 코드 생성

| 항목 | 내용 |
|------|------|
| Method | `GET` |
| URL | `/room/{roomId}/code` |
| 인증 | Bearer Token |

> 매칭으로 만들어진 방은 친구 초대 코드를 생성할 수 없습니다.

**Response (200)**
```json
{
  "code": 200,
  "message": "방 코드 조회 성공",
  "data": {
    "roomCode": "EF3674"
  }
}
```

---

### 3.6 친구 초대 코드로 방 입장

비밀번호 없이 초대 코드로 입장

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/room/join-by-code` |
| 인증 | Bearer Token + Request Body |

**Request Body**
```json
{
  "roomCode": "EF3674"
}
```

**Response (200)**
```json
{
  "code": 200,
  "message": "방 참여 성공",
  "data": {
    "id": 10,
    "name": "123",
    "token": "ws://localhost:4443?sessionId=10&token=tok_O1MIQ7kTED0ezP6D",
    "participants": [
      {
        "userId": "c0a81eac-9c02-1e49-819c-022ea1620000",
        "nickname": "hong gildong",
        "ready": true,
        "host": true
      },
      {
        "userId": "c0a81eac-9c02-1e49-819c-022ea1bf0001",
        "nickname": "hong gildong2",
        "ready": false,
        "host": false
      }
    ]
  }
}
```

---

## 4. 매칭 (Match)

### 4.1 매칭 시작

매칭 대기열에 자신을 추가

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/matchmaking/start` |
| 인증 | Bearer Token |

**Response (200)**
```json
{
  "code": 200,
  "message": "매칭이 시작되었습니다."
}
```

---

### 4.2 매칭 취소

매칭 대기열에서 자신 제외

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/matchmaking/cancel` |
| 인증 | Bearer Token |

**Response (200)**
```json
{
  "code": 200,
  "message": "매칭이 취소되었습니다."
}
```

---

## 5. 웹소켓 (WebSocket)

### 5.1 전역 웹소켓 연결

로그인 후 전역 웹소켓에 연결합니다. 매칭 관련 메시지를 받기 위해 필요합니다.

### 5.2 매칭 완료 메시지 처리

매칭이 완료되면 웹소켓을 통해 메시지를 받습니다.

### 5.3 대결 페이지 연결 세팅

OpenVidu 연결 및 웹소켓 연결 처리

### 5.4 메시지 받기

게임 제어 흐름 메시지 받기

### 5.5 메시지 보내기

게임 제어 흐름 메시지 보내기

---

## API 사용 예시 (axios)

### axios 인스턴스 설정

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: "https://localhost:8080",
});

// 로컬스토리지에 토큰이 있다면 모든 요청 헤더에 삽입
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### 매칭 시작 예시

```javascript
const startMatchmaking = async () => {
  try {
    const res = await api.post("/matchmaking/start");
    console.log("매칭 대기열 진입 성공");
  } catch (error) {
    console.error("매칭 시작 실패:", error);
  }
};
```

### 방 생성 예시

```javascript
const handleCreateRoom = async () => {
  const roomName = prompt("생성할 방 제목을 입력하세요.");
  const password = prompt("방 비밀번호를 입력하세요 (없으면 확인 클릭).");

  try {
    const res = await api.post("/room/create", {
      name: roomName,
      password: password || "",
      isElectronNeeded: false
    });

    const { id, name, token } = res.data.data;
    navigate(`/match/${id}`, { state: { token, roomName: name } });
  } catch (error) {
    console.error("방 생성 중 오류:", error);
  }
};
```

### 방 입장 예시

```javascript
const handleJoinRoom = async (room) => {
  let password = "";
  if (room.private) {
    password = prompt("비밀번호를 입력하세요.");
    if (password === null) return;
  }

  try {
    const res = await api.post("/room/join", { id: room.id, password });
    const { id, token, name } = res.data.data;
    navigate(`/match/${id}`, { state: { token, roomName: name } });
  } catch (error) {
    alert("입장 실패: " + (error.response?.data.message || "알 수 없는 오류"));
  }
};
```

---

## 부록: 신고하기 API (진행중)

| 항목 | 내용 |
|------|------|
| Method | `POST` |
| URL | `/api/game/report` |
| 구분 | GAME |
| 상태 | 진행중 |
| 설명 | 상대방 신고하기 |
