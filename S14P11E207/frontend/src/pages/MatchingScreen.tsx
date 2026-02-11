import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams, useBlocker } from 'react-router-dom';
import { FaUserCircle, FaSignal, FaCheck, FaTimes } from 'react-icons/fa';
import { userStore } from '../stores/userStore';
import { useWebSocket } from '../context/WebsocketContext';
import { api } from '../lib/axios';
import electronIcon from '../assets/electron-icon.png';

interface ParticipantStats {
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  currentWinStreak: number;
}

interface Participant {
  userId: string;
  nickname: string;
  ready: boolean;
  host: boolean;
  stats?: ParticipantStats;
  profileImageUrl?: string | null;
  electron?: boolean;
}

interface LocationState {
  token: string;
  roomName: string;
  participants: Participant[];
}

interface PlayerData {
  nickname: string;
  wins: number;
  losses: number;
  profileImageUrl?: string | null;
}

interface PlayerScreenProps extends PlayerData {
  isOpponent?: boolean;
  stream?: MediaStream | null;
  isReady: boolean;
  electron?: boolean;
  connectionQuality?: 'good' | 'unstable' | 'bad'; // Added prop
}

const PlayerScreen: React.FC<PlayerScreenProps> = ({
  nickname,
  wins,
  losses,
  profileImageUrl,
  isOpponent = false,
  stream,
  isReady,
  electron = false,
  connectionQuality = 'good' // Default to good
}) => {
  const [showElectronTooltip, setShowElectronTooltip] = useState(false);
  
  // Dynamic Styles based on State
  const containerStyle = isReady
    ? "border-[#00ff88]/50 shadow-[0_0_20px_rgba(0,255,136,0.1)]"
    : "border-white/10";

  // Connection Status Color
  const getConnectionColor = (quality: string) => {
    switch (quality) {
        case 'unstable': return 'bg-orange-500';
        case 'bad': return 'bg-red-500';
        default: return 'bg-green-500';
    }
  };

  return (
    <div 
      className={`
        relative flex1 rounded-3xl p-6 min-h-[40vh] md:min-h-[50vh] flex flex-col items-center
        transition-all duration-500 bg-white/5 backdrop-blur-md border ${containerStyle} overflow-hidden group
      `}
    >
      {/* Background Ambience */}
      <div className={`absolute inset-0 bg-gradient-to-b ${isOpponent ? 'from-red-500/5' : 'from-blue-500/5'} to-transparent opacity-50`} />
      
      {/* Helper Status (Electron / Connect) */}
      <div className="w-full flex justify-between items-start z-10 mb-4">
        {electron ? (
          <div
            className="relative"
            onMouseEnter={() => setShowElectronTooltip(true)}
            onMouseLeave={() => setShowElectronTooltip(false)}
          >
            <div className="bg-white/10 p-1.5 rounded-lg border border-white/10">
               <img src={electronIcon} alt="Electron" className="w-5 h-5 opacity-80" />
            </div>
            {showElectronTooltip && (
              <div className="absolute top-full left-0 mt-2 bg-black/90 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap border border-white/20">
                Electron App 사용자
              </div>
            )}
          </div>
        ) : (
          <div />
        )}
        
        {/* Live Indicator (Traffic Light) */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/5 bg-black/20`}>
            <div className={`w-2 h-2 rounded-full ${getConnectionColor(connectionQuality)} animate-pulse`} />
            <span className="text-[10px] text-white/50 font-mono">LIVE</span>
        </div>
      </div>
      
      {/* Avatar & Info */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full">
         
         {/* Avatar Circle */}
         <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center mb-6">
            {/* Glow Ring */}
            <div className={`absolute inset-0 rounded-full border border-white/10 ${isReady ? 'animate-pulse border-[#00ff88]/30 shadow-[0_0_30px_rgba(0,255,136,0.2)]' : ''}`} />
            
            <div className={`w-full h-full rounded-full overflow-hidden border-4 border-black/50 bg-[#2b2b2b] relative transition-all duration-500 ${isReady ? 'brightness-[0.3]' : 'brightness-100'}`}>
               {profileImageUrl ? (
                 <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
               ) : (
                 <FaUserCircle className="w-full h-full text-white/20 p-2" />
               )}
            </div>

            {/* Ready Overlay (Rotated Stamp Style) */}
            {isReady && (
                <div className="absolute inset-0 z-20 flex items-center justify-center animate-scaleIn">
                    <div className="transform -rotate-[15deg] bg-black/80 backdrop-blur-sm border-[4px] border-[#00ff88] px-6 py-2 shadow-[0_0_20px_rgba(0,255,136,0.5)] flex items-center justify-center min-w-[130%] hover:scale-105 transition-transform duration-300">
                        <span className="text-[#00ff88] font-black text-3xl md:text-4xl tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            READY
                        </span>
                    </div>
                </div>
            )}
         </div>

         {/* Name */}
         <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 tracking-tight" style={{ fontFamily: 'Yeongdo-Regular, sans-serif' }}>
           {nickname}
         </h2>

         {/* Stats (Compact Pills) */}
         <div className="flex items-center gap-3 w-full max-w-[200px]">
            <div className="flex-1 flex flex-col items-center bg-white/5 rounded-xl py-3 border border-white/5 group-hover:border-white/10 transition-colors">
                <span className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Win</span>
                <span className="text-xl font-bold text-blue-400">{wins}</span>
            </div>
            <div className="w-[1px] h-8 bg-white/10" />
            <div className="flex-1 flex flex-col items-center bg-white/5 rounded-xl py-3 border border-white/5 group-hover:border-white/10 transition-colors">
                <span className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Lose</span>
                <span className="text-xl font-bold text-red-400">{losses}</span>
            </div>
         </div>
      </div>
    </div>
  );
};

/**
 * 메인 매칭 화면
 */
const MatchingScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { participants, token, roomName } = (location.state as LocationState) || {};
  const { id: myId, nickname, totalWins, totalLosses, profileImage } = userStore();

  // WebSocket
  const { stompClient, isConnected } = useWebSocket();

  // 상대방 퇴장 모달
  const [showOpponentLeftModal, setShowOpponentLeftModal] = useState(false);

  // exit API 호출 여부 추적: 언마운트 시 STOMP UNSUBSCRIBE 즉시 전송을 방지
  const exitCalledRef = useRef(false);

  // Nav 클릭 시 방 퇴장 처리: exit API 호출 후 네비게이션 진행 (WebSocket 연결 유지)
  const blocker = useBlocker(({ nextLocation }) => {
    if (showOpponentLeftModal) return false;
    if (!userStore.getState().accessToken) return false;
    if (nextLocation.pathname.startsWith('/countdown/')) return false;
    if (nextLocation.pathname.startsWith('/battle/')) return false;
    if (nextLocation.pathname === '/battle-result') return false;
    if (nextLocation.pathname === '/match-load') return false;
    return true;
  });

  useEffect(() => {
    if (blocker.state === 'blocked') {
      exitCalledRef.current = true;
      if (roomId) {
        api.post(`/room/${roomId}/exit`)
          .catch((err) => console.error('퇴장 API 실패:', err))
          .finally(() => blocker.proceed());
      } else {
        blocker.proceed();
      }
    }
  }, [blocker, roomId]);

  // 내 데이터 (userStore에서)
  const myData: PlayerData = {
    nickname: nickname || '나',
    wins: totalWins,
    losses: totalLosses,
    profileImageUrl: profileImage,
  };

  // 참가자 정보 찾기
  const myParticipant = participants?.find(p => p.userId === myId);
  const opponent = participants?.find(p => p.userId !== myId);
  const opponentData: PlayerData = {
    nickname: opponent?.nickname || '상대방',
    wins: opponent?.stats?.totalWins ?? 0,
    losses: opponent?.stats?.totalLosses ?? 0,
    profileImageUrl: opponent?.profileImageUrl ?? null,
  };

  const [isMyReady, setIsMyReady] = useState<boolean>(false);
  const [isOpponentReady, setIsOpponentReady] = useState<boolean>(false);

  // 게임 이벤트 전송
  const sendGameEvent = useCallback((type: string, extraMessage: string | null = null, data: unknown = null) => {
    if (stompClient?.current?.connected && roomId) {
      console.log('sending:', type);
      stompClient.current.send(
        `/publish/${roomId}`,
        JSON.stringify({ type, message: extraMessage, data }),
      );
    }
  }, [roomId, stompClient]);

  // WebSocket 메세지 처리
  const handleSocketMessage = useCallback((payload: { type: string; message: string; data: Record<string, unknown> | null }) => {
    console.log('매칭 화면 메세지 수신:', payload);

    switch (payload.type) {
      case 'RESPONSE_READY_CHANGE': {
        if (payload.data) {
          const { userId, isReady: ready } = payload.data as { userId: string; isReady: boolean };
          if (userId === myId) {
            setIsMyReady(ready);
          } else {
            setIsOpponentReady(ready);
          }
        }
        break;
      }
      case 'RESPONSE_BATTLE_START': {
        // 게임 시작 → CountDown으로 이동
        navigate(`/countdown/${roomId}`, {
          state: {
            token,
            roomName,
            participants,
            battleStartData: payload.data,
          },
        });
        break;
      }
      case 'RESPONSE_PARTICIPANT_LEFT': {
        // 상대방 퇴장 모달 표시
        setShowOpponentLeftModal(true);
        break;
      }
      case 'RESPONSE_ROOM_DESTROYED': {
        // 방 파괴 → 상대방 퇴장 모달 표시 (WebSocket 유지)
        setShowOpponentLeftModal(true);
        break;
      }
      default:
        console.log('알 수 없는 메세지:', payload);
        break;
    }
  }, [myId, roomId, token, roomName, participants, navigate]);

  // /topic/${roomId} 구독
  useEffect(() => {
    if (!isConnected || !stompClient?.current?.connected || !roomId) return;

    console.log(`매칭 화면: ${roomId}번 방 구독 시작`);
    let active = true;

    const subscription = stompClient.current.subscribe(`/topic/${roomId}`, (msg) => {
      if (!active) return;
      handleSocketMessage(JSON.parse(msg.body));
    });

    const errorSubscription = stompClient.current.subscribe(
      `/user/queue/errors/${roomId}`,
      (message) => {
        if (!active) return;
        const errorData = JSON.parse(message.body);
        console.error('오류:', errorData.message);
      },
    );

    return () => {
      active = false;
      if (!exitCalledRef.current && stompClient.current?.connected) {
        // 일반 cleanup (의존성 변경 등): 즉시 구독 해지
        subscription.unsubscribe();
        errorSubscription.unsubscribe();
      }
      // exit API로 나가는 경우: STOMP UNSUBSCRIBE를 보내지 않음
      // → 백엔드 이중 퇴장 방지, 구독은 WebSocket 연결 종료 시 자동 정리
    };
  }, [isConnected, roomId, stompClient, handleSocketMessage]);

  // 준비 토글
  const handleReady = () => {
    const next = !isMyReady;
    setIsMyReady(next);
    sendGameEvent('REQUEST_READY_CHANGE', null, { isReady: next });
  };

  // 건너뛰기: exit API 호출 후 재매칭
  const handleSkip = async () => {
    if (roomId) {
      exitCalledRef.current = true;
      try {
        await api.post(`/room/${roomId}/exit`);
      } catch (err) {
        console.error('퇴장 API 실패:', err);
      }
    }
    navigate('/match-load');
  };

  return (
    <>
      {/* Play Area Container */}
      <div className="w-full max-w-6xl px-4 mb-8 flex flex-col items-center">
        
        {/* Match Title */}
        <div className="mb-10 text-center animate-fadeIn">
            <h2 className="text-white/50 text-sm font-bold tracking-[0.3em] uppercase mb-2">Match Found</h2>
            <div className="w-12 h-1 bg-[#00ff88]/50 mx-auto rounded-full" />
        </div>

        {/* Players & VS Container */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 w-full relative">
          
          {/* Player 1 (Me) */}
          <div className="w-full md:w-[45%] z-10 animate-fadeInLeft">
             <PlayerScreen
                nickname={myData.nickname}
                wins={myData.wins}
                losses={myData.losses}
                profileImageUrl={myData.profileImageUrl}
                isReady={isMyReady}
                electron={myParticipant?.electron}
                connectionQuality="good" // Mocked for now, can be dynamic later
             />
          </div>

          {/* VS Divider (Fixed: Simplified for robustness) */}
          <div className="relative z-20 flex flex-col items-center justify-center shrink-0 animate-scaleIn delay-300">
             <span 
                className="text-6xl md:text-8xl font-black italic text-[#00ff88] drop-shadow-[0_0_20px_rgba(0,255,136,0.4)]" 
                style={{ fontFamily: 'Yeongdo-Regular, sans-serif' }}
             >
               VS
             </span>
          </div>

          {/* Player 2 (Opponent) */}
          <div className="w-full md:w-[45%] z-10 animate-fadeInRight">
             <PlayerScreen
                nickname={opponentData.nickname}
                wins={opponentData.wins}
                losses={opponentData.losses}
                profileImageUrl={opponentData.profileImageUrl}
                isOpponent={true}
                isReady={isOpponentReady}
                electron={opponent?.electron}
                connectionQuality="good" // Mocked
             />
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex flex-col items-center gap-6 mt-12 w-full max-w-md animate-fadeInUp delay-500">
          
          {/* Ready Button (Reverted to Solid/Bordered Style) */}
          <button
             className={`
              w-full py-4 text-xl font-bold rounded-2xl cursor-pointer
              transition-all duration-200 transform active:scale-[0.98]
              flex items-center justify-center gap-2
              ${isMyReady
                ? 'bg-transparent border-2 border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88]/10'
                : 'bg-[#00ff88] border-2 border-[#00ff88] text-black hover:bg-[#00e67a] hover:border-[#00e67a] shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:shadow-[0_0_30px_rgba(0,255,136,0.5)]'
              }
            `}
            onClick={handleReady}
          >
            {isMyReady ? (
               <>
                 <span>준비 취소</span>
                 <FaTimes />
               </>
            ) : (
               <>
                 <span>GAME READY</span>
                 <FaCheck />
               </>
            )}
          </button>
          
          {/* Skip Button (Updated Text) */}
          <button
            onClick={handleSkip}
            className="text-white/40 text-sm font-medium hover:text-white transition-colors flex items-center gap-2 py-2 px-6 rounded-full hover:bg-white/5 group"
          >
            다른 상대 찾기 
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>

      </div>

      <style>{`
        @keyframes fadeInLeft {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeInLeft { animation: fadeInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes fadeInRight {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeInRight { animation: fadeInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
        }
        .animate-scaleIn { animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>

      {/* 양쪽 모두 준비 완료 시 표시 */}
      {isMyReady && isOpponentReady && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] animate-fadeIn">
          <h1 className="text-[#00ff88] text-7xl animate-pulse">
            게임 시작!
          </h1>
        </div>
      )}

      {/* 상대방 퇴장 모달 */}
      {showOpponentLeftModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]">
          <div className="bg-[#1a1a1a] p-10 rounded-3xl text-center max-w-md">
            <div className="text-2xl font-bold mb-4">상대방이 나갔습니다</div>
            <div className="text-gray-400 mb-8 leading-relaxed">
              상대방이 매칭을 떠났습니다.<br />
              새로운 상대를 찾아볼까요?
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/')}
                className="px-8 py-3 bg-[#333] hover:bg-[#444] text-white rounded-lg font-bold transition-colors"
              >
                로비로
              </button>
              <button
                onClick={() => navigate('/match-load')}
                className="px-8 py-3 bg-[#00ff88] hover:bg-[#00dd77] text-black rounded-lg font-bold transition-colors"
              >
                재매칭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MatchingScreen;
