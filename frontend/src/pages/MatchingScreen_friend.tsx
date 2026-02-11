import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useBlocker } from 'react-router-dom';
import { FaCheck, FaCopy, FaCrown, FaSignal, FaTimes, FaUserCircle, FaUserPlus } from 'react-icons/fa';
import { useWebSocket } from '../context/WebsocketContext';
import { userStore } from '../stores/userStore';
import { mediaDeviceStore } from '../stores/mediaDeviceStore';
import VideoPreview from '../components/VideoPreview';
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
  roomCode?: string;
}

interface PlayerData {
  nickname: string;
  wins: number;
  losses: number;
  profileImageUrl?: string | null;
}

interface PlayerScreenProps extends PlayerData {
  isHost?: boolean;
  isReady: boolean;
  isEmpty?: boolean;
  content?: React.ReactNode;
  electron?: boolean;
}

const PlayerScreen: React.FC<PlayerScreenProps> = ({
  nickname,
  wins,
  losses,
  profileImageUrl,
  isHost = false,
  isReady,
  isEmpty = false,
  content,
  electron = false,
}) => {
  const [showElectronTooltip, setShowElectronTooltip] = useState(false);
  const borderStyle = isEmpty ? 'border-white/10' : 'border-[#00ff88]';

  return (
    <div className={`aspect-[3/4] h-[65vh] max-w-full rounded-2xl p-6 md:p-8 flex flex-col relative border-[3px] ${borderStyle} transition-all duration-300 bg-black`}>
      {/* 상단 영역: 일렉트론 아이콘(좌) + 신호 아이콘(우) */}
      <div className="flex justify-between items-start mb-5">
        {/* 일렉트론 아이콘 (좌측 상단) */}
        {electron && !isEmpty ? (
          <div
            className="relative z-20"
            onMouseEnter={() => setShowElectronTooltip(true)}
            onMouseLeave={() => setShowElectronTooltip(false)}
          >
            <img src={electronIcon} alt="Electron" className="w-8 h-8 cursor-pointer bg-white rounded-full p-0.5" />
            {showElectronTooltip && (
              <div className="absolute top-full left-0 mt-2 bg-black/90 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap z-30 border border-white/20">
                {nickname}님은 일렉트론 앱을 사용중입니다.
              </div>
            )}
          </div>
        ) : (
          <div className="w-6" />
        )}
        <FaSignal className="text-white text-2xl" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
              <FaUserPlus className="text-white/20 text-5xl" />
            </div>
            <div className="text-white/40 text-xl font-medium animate-pulse">상대방 대기 중...</div>
          </div>
        ) : (
          <>
            {content ? (
              <div className="w-full mb-6">
                {content}
              </div>
            ) : (
             <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full flex items-center justify-center mb-6">
                <div className={`w-full h-full rounded-full overflow-hidden border-4 border-black/50 bg-[#2b2b2b] relative transition-all duration-500 ${isReady ? 'brightness-[0.3]' : 'brightness-100'}`}>
                   {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt="profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FaUserCircle className="w-full h-full text-white/20 p-2" />
                  )}
                </div>
                {isHost && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl text-[#00ff88] z-30 drop-shadow-md">
                    <FaCrown />
                  </div>
                )}
                
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
            )}

            <h2 className="text-xl md:text-2xl font-medium text-white mb-6 md:mb-8 tracking-wide">{nickname}</h2>

            <div className="flex gap-3 md:gap-4 mt-auto">
              <div className={`py-2 px-4 md:px-6 rounded-full font-medium transition-colors ${isReady ? 'bg-blue-700/60 text-white/80' : 'bg-blue-600 text-white'}`}>
                Win : {wins}
              </div>
              <div className={`py-2 px-4 md:px-6 rounded-full font-medium transition-colors ${isReady ? 'bg-red-800/60 text-white/80' : 'bg-red-600 text-white'}`}>
                Lose : {losses}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const InviteModal: React.FC<{ isOpen: boolean; onClose: () => void; roomLink: string }> = ({
  isOpen,
  onClose,
  roomLink,
}) => {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('링크 복사 실패:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[2000] p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl p-8 max-w-md w-full relative border-[3px] border-[#00ff88] shadow-[0_0_30px_rgba(0,255,136,0.2)]">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-[#00ff88] transition-colors">
          <FaTimes className="text-2xl" />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">링크 공유하기</h2>
          <p className="text-white/40 text-sm">친구에게 초대 링크를 보내주세요.</p>
        </div>

        <button
          onClick={handleCopy}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 ${copied ? 'bg-white text-black' : 'bg-[#00ff88] text-black hover:bg-[#00dd77]'
            }`}
        >
          {copied ? <FaCheck /> : <FaCopy />}
          {copied ? '복사 완료!' : '링크 복사하기'}
        </button>
      </div>
    </div>
  );
};

const RoomMatchingScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { participants: initialParticipants, token, roomName, roomCode } = (location.state as LocationState) || {};
  const { id: myId, nickname, totalWins, totalLosses, profileImage, accessToken, fetchUserData } = userStore();
  const { currentCameraId, currentMicId, cameraStream, micStream } = mediaDeviceStore();
  const { stompClient, isConnected } = useWebSocket();

  const [participants, setParticipants] = useState<Participant[]>(initialParticipants || []);
  const [isMyReady, setIsMyReady] = useState(false);
  const [isOpponentReady, setIsOpponentReady] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isGameStarting, setIsGameStarting] = useState(false);
  const battleStartSentRef = useRef(false);
  const myIdRef = useRef(myId);
  const participantsRef = useRef(participants);

  // exit API 호출 여부 추적: 언마운트 시 STOMP UNSUBSCRIBE 즉시 전송을 방지
  const exitCalledRef = useRef(false);

  // Nav 클릭 시 방 퇴장 처리: exit API 호출 후 네비게이션 진행 (WebSocket 연결 유지)
  const blocker = useBlocker(({ nextLocation }) => {
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

  // myId가 변경되면 ref도 업데이트
  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  // participants가 변경되면 ref도 업데이트
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const isDeviceReady = Boolean(cameraStream && micStream && currentMicId);
  const myParticipant = participants.find((p) => p.userId === myId);
  const hostParticipant = participants.find((p) => p.host);
  const opponent = participants.find((p) => p.userId !== myId);
  const isHost = Boolean(myParticipant?.host);

  const roomLink = useMemo(() => {
    if (!roomCode) return '';
    return `${window.location.origin}/room/invite?code=${roomCode}`;
  }, [roomCode]);

  useEffect(() => {
    if (!roomId || !token) {
      alert('방 정보가 없습니다.');
      navigate('/room');
      return;
    }
  }, [navigate, roomId, token]);

  // 초대 링크로 들어온 경우 myId가 없을 수 있음 → fetchUserData 호출
  useEffect(() => {
    if (!myId && accessToken) {
      fetchUserData();
    }
  }, [myId, accessToken, fetchUserData]);

  // Ready 상태 초기화: 호스트는 항상 Ready, 게스트는 서버에서 받은 상태 사용
  useEffect(() => {
    if (!initialParticipants || !myId) return;

    const me = initialParticipants.find((p) => p.userId === myId);
    const other = initialParticipants.find((p) => p.userId !== myId);

    // 호스트는 항상 Ready 상태
    if (me?.host) {
      setIsMyReady(true);
    } else {
      setIsMyReady(me?.ready ?? false);
    }
    setIsOpponentReady(other?.ready ?? false);
  }, [initialParticipants, myId]);

  const sendGameEvent = useCallback(
    (type: string, extraMessage: string | null = null, data: unknown = null) => {
      console.log('[MatchingRoom] sendGameEvent 호출 - type:', type, 'connected:', stompClient?.current?.connected, 'roomId:', roomId);
      if (stompClient?.current?.connected && roomId) {
        console.log('[MatchingRoom] 메시지 전송:', type, data);
        stompClient.current.send(`/publish/${roomId}`, JSON.stringify({ type, message: extraMessage, data }));
      } else {
        console.warn('[MatchingRoom] 메시지 전송 실패 - 연결 안됨');
      }
    },
    [roomId, stompClient]
  );

  const handleSocketMessage = useCallback(
    (payload: { type: string; message: string; data: Record<string, unknown> | null }) => {
      console.log('[MatchingRoom] 소켓 메시지:', payload.type, payload.data);
      switch (payload.type) {
        case 'RESPONSE_READY_CHANGE': {
          if (payload.data) {
            const { userId, isReady: ready } = payload.data as { userId: string; isReady: boolean };
            console.log('[MatchingRoom] READY_CHANGE - userId:', userId, 'myIdRef:', myIdRef.current, 'isReady:', ready);
            if (userId === myIdRef.current) {
              setIsMyReady(ready);
            } else {
              setIsOpponentReady(ready);
            }
          }
          break;
        }
        case 'RESPONSE_PARTICIPANT_JOINED': {
          console.log('[MatchingRoom] PARTICIPANT_JOINED:', payload.data);
          if (payload.data) {
            const { userId, nickname: joinedNickname, stats: joinedStats, profileImageUrl: joinedProfileImage, isElectron } = payload.data as { userId: string; nickname: string; stats?: ParticipantStats; profileImageUrl?: string | null; isElectron?: boolean };
            setParticipants((prev) => {
              if (prev.some((p) => p.userId === userId)) return prev;
              console.log('[MatchingRoom] 참가자 추가:', joinedNickname);
              return [...prev, { userId, nickname: joinedNickname, ready: false, host: false, stats: joinedStats, profileImageUrl: joinedProfileImage, electron: isElectron }];
            });
          }
          break;
        }
        case 'RESPONSE_PARTICIPANT_LEFT': {
          if (payload.data) {
            const { leftUserId } = payload.data as { leftUserId: string };
            setParticipants((prev) => prev.filter((p) => p.userId !== leftUserId));
            if (leftUserId !== myIdRef.current) {
              setIsOpponentReady(false);
            }
          }
          break;
        }
        case 'RESPONSE_HOST_CHANGED': {
          if (payload.data) {
            const { prevHostId, nextHostId } = payload.data as { prevHostId: string; nextHostId: string };
            setParticipants((prev) =>
              prev
                .filter((p) => p.userId !== prevHostId) // 이전 호스트 제거 (퇴장)
                .map((p) => ({
                  ...p,
                  host: p.userId === nextHostId ? true : p.host,
                }))
            );
            // 내가 새 호스트가 되면 Ready 상태로 전환
            if (nextHostId === myIdRef.current) {
              setIsMyReady(true);
            }
            // 이전 호스트가 상대방이었으면 ready 초기화
            if (prevHostId !== myIdRef.current) {
              setIsOpponentReady(false);
            }
          }
          break;
        }
        case 'RESPONSE_BATTLE_START': {
          navigate(`/countdown/${roomId}`, {
            state: {
              token,
              roomName,
              participants: participantsRef.current,
              battleStartData: payload.data,
            },
          });
          break;
        }
        case 'RESPONSE_ROOM_DESTROYED': {
          alert(payload.message);
          navigate('/');
          break;
        }
        default:
          break;
      }
    },
    [navigate, roomId, roomName, token]
  );

  useEffect(() => {
    if (!isConnected || !stompClient?.current?.connected || !roomId) return;

    console.log('[MatchingRoom] 소켓 구독 시작 - roomId:', roomId, 'myIdRef:', myIdRef.current);
    let active = true;

    const subscription = stompClient.current.subscribe(`/topic/${roomId}`, (msg) => {
      if (!active) return;
      handleSocketMessage(JSON.parse(msg.body));
    });

    const errorSubscription = stompClient.current.subscribe(`/user/queue/errors/${roomId}`, (message) => {
      if (!active) return;
      const errorData = JSON.parse(message.body);
      console.error('소켓 에러:', errorData.message);
    });

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
  }, [handleSocketMessage, isConnected, roomId, stompClient]);

  // 게스트의 Ready 토글
  const handleReady = () => {
    if (!opponent || !isDeviceReady || isHost) return;
    const next = !isMyReady;
    setIsMyReady(next);
    sendGameEvent('REQUEST_READY_CHANGE', null, { isReady: next });
  };

  // 호스트의 게임 시작
  const handleStartGame = () => {
    if (!isHost || !isOpponentReady || !isDeviceReady || battleStartSentRef.current) return;
    battleStartSentRef.current = true;
    setIsGameStarting(true);
    sendGameEvent('REQUEST_BATTLE_START');
  };

  // 상대방이 Ready를 취소하면 다시 시작할 수 있도록
  useEffect(() => {
    if (!isOpponentReady) {
      battleStartSentRef.current = false;
      setIsGameStarting(false);
    }
  }, [isOpponentReady]);

  const isReadyDisabled = !opponent || !isDeviceReady;
  const isStartDisabled = !opponent || !isDeviceReady || !isOpponentReady;

  const orderedParticipants = hostParticipant
    ? [hostParticipant, ...participants.filter((p) => p.userId !== hostParticipant.userId)]
    : participants;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-start md:justify-center px-4 py-6 sm:px-6 relative">
        <div className="text-center mb-10">
          <h2 className="text-[#00ff88] font-bold tracking-[0.3em] uppercase text-sm mb-2">Matchmaking Room</h2>

          {roomCode && (
            <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-6 py-2 mb-4 cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(roomCode);
                alert('방 코드가 복사되었습니다: ' + roomCode);
              }}>
              <span className="text-white/60 text-sm">CODE</span>
              <span className="text-white font-mono text-xl font-bold tracking-widest">{roomCode}</span>
              <FaCopy className="text-white/40 text-sm" />
            </div>
          )}

          <p className="text-white/40 font-medium">친구가 준비되면 게임이 시작됩니다.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 mb-10 max-w-[90vw] w-full items-center justify-center">
          {orderedParticipants.length === 0 && (
            <PlayerScreen
              nickname={nickname || '나'}
              wins={totalWins}
              losses={totalLosses}
              profileImageUrl={profileImage}
              isHost={false}
              isReady={isMyReady}
              electron={myParticipant?.electron}
            />
          )}
          {orderedParticipants
            .filter((p) => p.userId)
            .map((participant) => {
              const isMe = participant.userId === myId;
              const data: PlayerData = isMe
                ? {
                  nickname: nickname || participant.nickname || '나',
                  wins: totalWins,
                  losses: totalLosses,
                  profileImageUrl: profileImage,
                }
                : {
                  nickname: participant.nickname || '상대방',
                  wins: participant.stats?.totalWins ?? 0,
                  losses: participant.stats?.totalLosses ?? 0,
                  profileImageUrl: participant.profileImageUrl ?? null,
                };

              // 호스트는 Ready 상태로 표시 (본인 화면은 디바이스 설정 완료 후에만)
              const readyState = participant.host
                ? (isMe ? isDeviceReady : true)
                : (isMe ? isMyReady : isOpponentReady);

              const previewContent = isMe && !isDeviceReady ? (
                <div className="relative w-full">
                  <VideoPreview className="w-full aspect-[4/3] rounded-2xl overflow-hidden" showControls />
                  <div className="absolute top-3 left-3 text-xs md:text-sm font-semibold text-white/90 bg-black/60 px-3 py-1 rounded-full">
                    카메라/마이크 테스트
                  </div>
                </div>
              ) : undefined;

              return (
                <PlayerScreen
                  key={participant.userId}
                  {...data}
                  isHost={participant.host}
                  isReady={readyState}
                  content={previewContent}
                  electron={participant.electron}
                />
              );
            })}
          {/* 상대가 나간 후 빈 슬롯 표시 */}
          {orderedParticipants.filter((p) => p.userId).length === 1 && (
            <PlayerScreen
              nickname=""
              wins={0}
              losses={0}
              isHost={false}
              isReady={false}
              isEmpty={true}
            />
          )}
        </div>

        <div className="w-full max-w-[90vw] flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
            <div className="hidden md:block" />
            {isHost ? (
              // 호스트: 게임 시작 버튼
              <button
                onClick={handleStartGame}
                disabled={isStartDisabled}
                className={`justify-self-center py-4 px-12 md:py-5 md:px-20 text-lg md:text-xl font-bold rounded-xl border-[3px] transition-all transform active:scale-95 ${isStartDisabled
                  ? 'border-white/10 text-white/20 cursor-not-allowed'
                  : 'border-[#00ff88] bg-[#00ff88] text-black hover:bg-[#00dd77]'
                  }`}
              >
                게임 시작
              </button>
            ) : (
              // 게스트: Ready 버튼
              <button
                onClick={handleReady}
                disabled={isReadyDisabled}
                className={`justify-self-center py-4 px-12 md:py-5 md:px-20 text-lg md:text-xl font-bold rounded-xl border-[3px] transition-all transform active:scale-95 ${isReadyDisabled
                  ? 'border-white/10 text-white/20 cursor-not-allowed'
                  : isMyReady
                    ? 'border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88]/10'
                    : 'border-[#00ff88] bg-[#00ff88] text-black hover:bg-[#00dd77]'
                  }`}
              >
                {isMyReady ? '취소' : 'READY'}
              </button>
            )}

            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="md:justify-self-end w-full md:w-auto bg-white text-black py-3 px-6 rounded-xl flex items-center justify-center gap-3 font-bold hover:bg-neutral-200 transition-all"
            >
              <FaUserPlus /> 친구 초대하기
            </button>
          </div>
          {isHost ? (
            // 호스트용 안내 메시지
            isStartDisabled && (
              <p className="text-xs text-white/40 text-center">
                {!opponent
                  ? '친구가 들어오면 게임을 시작할 수 있습니다.'
                  : !isDeviceReady
                    ? '카메라/마이크 테스트를 완료해주세요.'
                    : '친구가 준비되면 게임을 시작할 수 있습니다.'}
              </p>
            )
          ) : (
            // 게스트용 안내 메시지
            isReadyDisabled && (
              <p className="text-xs text-white/40 text-center">
                {!opponent
                  ? '호스트를 기다리는 중입니다.'
                  : !isDeviceReady
                    ? '카메라/마이크 테스트를 완료해주세요.'
                    : '준비가 되면 레디를 눌러주세요.'}
              </p>
            )
          )}
        </div>

        {/* 게임 시작 요청 후 로딩 표시 */}
        {isGameStarting && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[3000]">
            <h1 className="text-[#00ff88] text-7xl font-bold animate-pulse">게임 시작!</h1>
          </div>
        )}
      </main>

      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} roomLink={roomLink} />
    </div>
  );
};

export default RoomMatchingScreen;
