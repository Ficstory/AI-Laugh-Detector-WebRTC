import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/axios';
import { useModalRouter } from '../hooks/useModalRouter';
import { userStore } from '../stores/userStore';

interface JoinByCodeResponse {
  id: number;
  name: string;
  token: string;
  participants: {
    userId: string;
    nickname: string;
    ready: boolean;
    host: boolean;
    profileImageUrl?: string | null;
    electron?: boolean;
  }[];
}

function RoomInvite() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { openModal, closeModal } = useModalRouter();
  const { accessToken } = userStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);
  const loginOpenedRef = useRef(false);

  useEffect(() => {
    const roomCode = searchParams.get('code');

    if (!roomCode) {
      setErrorMessage('초대 코드가 없습니다.');
      return;
    }

    if (!accessToken) {
      const redirectParams = new URLSearchParams(location.search);
      redirectParams.delete('modal');
      const redirectQuery = redirectParams.toString();
      const redirectPath = redirectQuery ? `${location.pathname}?${redirectQuery}` : location.pathname;
      sessionStorage.setItem('postLoginRedirect', redirectPath);
      if (!loginOpenedRef.current) {
        loginOpenedRef.current = true;
        openModal('login');
      }
      return;
    }

    if (location.search.includes('modal=')) {
      closeModal();
      const cleanedParams = new URLSearchParams(location.search);
      cleanedParams.delete('modal');
      const cleanedQuery = cleanedParams.toString();
      const cleanedUrl = cleanedQuery ? `${location.pathname}?${cleanedQuery}` : location.pathname;
      navigate(cleanedUrl, { replace: true });
    }

    if (startedRef.current) return;
    startedRef.current = true;

    const joinRoom = async () => {
      try {
        const res = await api.post('/room/join-by-code', { roomCode });
        const payload = res.data?.data as JoinByCodeResponse | undefined;
        if (!payload?.id || !payload?.token) {
          throw new Error(res.data?.message || '초대 코드로 방에 들어갈 수 없습니다.');
        }
        navigate(`/room/matching/${payload.id}`, {
          state: {
            token: payload.token,
            roomName: payload.name,
            participants: payload.participants,
            roomCode,
          },
          replace: true,
        });
      } catch (error) {
        console.error('초대 코드 입장 실패:', error);
        const message: string =
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          (error as { response?: { data?: { message?: string } } }).response?.data?.message
            ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
            : error instanceof Error
              ? error.message
              : '초대 코드로 방에 들어갈 수 없습니다.';
        setErrorMessage(message ?? null);
      }
    };

    joinRoom();
  }, [accessToken, closeModal, location.pathname, location.search, navigate, openModal, searchParams]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="text-center space-y-3">
        {errorMessage ? (
          <>
            <h1 className="text-xl font-bold">입장 실패</h1>
            <p className="text-sm text-white/70">{errorMessage}</p>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-white/70 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-white/70">초대 방으로 이동 중...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default RoomInvite;
