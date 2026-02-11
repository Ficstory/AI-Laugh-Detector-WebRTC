import { useRef, useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import SockJS from 'sockjs-client';
import Stomp from 'webstomp-client';
import { WebSocketContext } from '../../context/WebsocketContext';
import type { WebSocketContextType } from '../../context/WebsocketContext';
import { userStore } from '../../stores/userStore';
import { api } from '../../lib/axios';

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // 만료 30초 전부터 만료로 간주
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
};

const ensureFreshToken = async (): Promise<string | null> => {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;

  if (!isTokenExpired(token)) return token;

  // 토큰 만료 → 쿠키의 refreshToken으로 재발급
  try {
    // 쿠키에서 자동으로 refresh_token 전송 (withCredentials: true)
    const response = await api.post('/auth/refresh');
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;
    userStore.getState().setTokens(newAccessToken, newRefreshToken);
    return newAccessToken;
  } catch {
    return null;
  }
};

const MAX_RECONNECT_ATTEMPTS = 5;

function WebsocketLayout() {
  const stompClient = useRef<ReturnType<typeof Stomp.over> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAttempted, setIsAttempted] = useState(false);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const accessToken = userStore((state) => state.accessToken);

  const connect = useCallback(async () => {
    if (stompClient.current?.connected) {
      setIsConnected(true);
      setIsAttempted(true);
      return;
    }

    // 토큰 유효성 확인 및 만료 시 자동 갱신
    const token = await ensureFreshToken();
    console.log('[WS] connect() 호출 | 토큰:', token ? '있음' : '없음', '| 이미 연결:', !!stompClient.current?.connected);

    if (!token) {
      console.warn('[WS] 소켓 연결 생략: 유효한 토큰 없음');
      setIsAttempted(true);
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:8081';
    console.log('[WS] 연결 시도:', `${wsUrl}/connect`);
    const socket = new SockJS(`${wsUrl}/connect`, null, {
      transports: ['xhr-streaming', 'xhr-polling'],
    });
    const client = Stomp.over(socket);

    client.connect(
      { Authorization: `Bearer ${token}` },
      () => {
        stompClient.current = client;
        setIsConnected(true);
        reconnectAttempts.current = 0;
        console.log('[WS] 연결 성공');
      },
      (error) => {
        console.error('[WS] 연결 끊김:', error);
        stompClient.current = null;
        setIsConnected(false);
        setIsAttempted(true);

        // 로그아웃 상태이면 재연결 불필요
        if (!localStorage.getItem('accessToken')) return;

        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          console.warn('[WS] 최대 재연결 시도 초과');
          return;
        }

        // 지수 백오프: 1s → 2s → 4s → 8s → 16s (최대 30s)
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30_000);
        reconnectAttempts.current += 1;
        console.log(`[WS] ${delay}ms 후 재연결 시도 (${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);

        reconnectTimer.current = setTimeout(() => {
          connect();
        }, delay);
      },
    );
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    reconnectAttempts.current = 0;

    if (stompClient.current) {
      stompClient.current.disconnect();
      stompClient.current = null;
      setIsConnected(false);
      console.log('WebSocket 연결 해제');
    }
  }, []);

  // 레이아웃 마운트 시 자동 연결, 언마운트 시 연결 해제
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // 페이지 리로드/닫기 시 WebSocket 즉시 정리
  // → 백엔드가 구 세션 끊김을 즉시 감지하여, 재접속 후 지연 퇴장 방지
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (stompClient.current) {
        try {
          stompClient.current.disconnect();
        } catch (e) { /* ignore */ }
        stompClient.current = null;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 로그아웃 시(accessToken 제거) 즉시 WebSocket 연결 해제
  useEffect(() => {
    if (!accessToken) {
      if (stompClient.current?.connected) {
        disconnect();
      }
      setIsAttempted(true);
    }
  }, [accessToken, disconnect]);

  // 매칭 알림 채널 구독 (/user/queue/match)
  useEffect(() => {
    if (!isConnected || !stompClient.current?.connected) return;

    const subscription = stompClient.current.subscribe('/user/queue/match', (message) => {
      const response = JSON.parse(message.body);
      if (response.type === 'RESPONSE_MATCHMAKING_SUCCESS') {
        console.log('매칭 성공:', response);
        const { id, name, participants, token: openviduToken } = response.data;
        navigate(`/matching-screen/${id}`, {
          state: {
            token: openviduToken,
            roomName: name,
            participants,
          },
        });
      }
    });

    return () => {
      if (stompClient.current?.connected) {
        subscription.unsubscribe();
      }
    };
  }, [isConnected, navigate]);

  const contextValue: WebSocketContextType = {
    stompClient,
    isConnected,
    connect,
    disconnect,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {isConnected || isAttempted ? (
        <Outlet />
      ) : (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#121212] text-white">
          {/* Radar Animation */}
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute w-24 h-24 bg-white rounded-full opacity-10 animate-ping"></div>
            <div className="absolute w-12 h-12 bg-white rounded-full opacity-20 animate-pulse"></div>
            <div className="relative z-10 text-4xl filter grayscale opacity-80">🛰️</div>
          </div>

          {/* Text Content */}
          <h2 className="text-2xl font-bold mb-2 animate-pulse">서버와 연결하고 있어요</h2>
          <p className="text-gray-400 text-sm font-medium">잠시만 기다려주세요</p>
        </div>
      )}
    </WebSocketContext.Provider>
  );
}

export default WebsocketLayout;
