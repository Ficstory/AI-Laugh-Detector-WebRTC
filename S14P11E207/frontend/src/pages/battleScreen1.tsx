import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams, useBlocker } from 'react-router-dom';
import { OpenVidu, Session, Publisher, Subscriber } from 'openvidu-browser';
import { userStore } from '../stores/userStore';
import { mediaDeviceStore } from '../stores/mediaDeviceStore';
import { useWebSocket } from '../context/WebsocketContext';
import { useBlockCapture } from '../hooks/useBlockCapture';
import { CaptureWarningModal } from '../components/CaptureWarningModal';
import { SmileDetector, type DetectionResult } from '../services/smileDetector';
import { api } from '../lib/axios';

type ReportReason = 'PROFANITY' | 'INAPPROPRIATE_BEHAVIOR' | 'OTHER';

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  PROFANITY: '욕설/비속어 사용',
  INAPPROPRIATE_BEHAVIOR: '부적절한 행동 (부적절한 영상 노출 등)',
  OTHER: '기타',
};

interface Participant {
  userId: string;
  nickname: string;
  ready?: boolean;
  host?: boolean;
  totalWins?: number;
  totalLosses?: number;
  profileImageUrl?: string | null;
  electron?: boolean;
}

interface BattleStartData {
  attackerId: string;
  turn: number;
  round: number;
  scores: Record<string, number>;
}

interface TurnResultEntry {
  turnNumber: number;
  attackerId: string;
  success: boolean; // true = 상대를 웃김, false = 못 웃김
}

interface LocationState {
  token: string;
  roomName: string;
  participants: Participant[];
  battleStartData: BattleStartData;
}

const BattleGame = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { id: myUserId, accessToken } = userStore();
  const { currentCameraId, currentMicId } = mediaDeviceStore();
  const { stompClient, isConnected } = useWebSocket();

  const { token, participants, battleStartData } = (location.state as LocationState) || {};
  const { open: captureOpen, close: captureClose, blurred, focusWarning, focusTimedOut } = useBlockCapture();

  // Game state
  const [attackerId, setAttackerId] = useState<string>(battleStartData?.attackerId || '');
  const [turn, setTurn] = useState<number>(battleStartData?.turn || 1);
  const [round, setRound] = useState<number>(battleStartData?.round || 1);
  const [scores, setScores] = useState<Record<string, number>>(battleStartData?.scores || {});
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [showCountdown, setShowCountdown] = useState<boolean>(true);
  const [countdownNumber, setCountdownNumber] = useState<number>(3);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason | ''>('');
  const [reportDetail, setReportDetail] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [turnHistory, setTurnHistory] = useState<TurnResultEntry[]>([]);
  const [showTurnResultModal, setShowTurnResultModal] = useState(false);
  const [lastTurnResult, setLastTurnResult] = useState<{
    wasAttacker: boolean;
    success: boolean;
  } | null>(null);
  const turnResultTimerRef = useRef<number | null>(null);

  // Navigation blocker — intercept nav clicks during battle
  const allowNavigationRef = useRef(false);
  const blocker = useBlocker(({ nextLocation }) => {
    if (allowNavigationRef.current) return false;
    if (!userStore.getState().accessToken) return false;
    if (nextLocation.pathname === '/battle-result') return false;
    return true;
  });

  // Show quit modal when navigation is blocked (e.g. nav bar click)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowQuitModal(true);
    }
  }, [blocker.state]);


  // OpenVidu state
  const [session, setSession] = useState<Session | null>(null);
  const [publisher, setPublisher] = useState<Publisher | null>(null);
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const turnSwapSentRef = useRef<boolean>(false);
  const turnSwapLockRef = useRef<boolean>(false);

  // AI Smile Detector
  const detectorRef = useRef<SmileDetector | null>(null);
  const [aiResults, setAiResults] = useState<DetectionResult[]>([]);
  const [isAiReady, setIsAiReady] = useState(false);
  const remoteDetectorRef = useRef<SmileDetector | null>(null);
  const [remoteAiResults, setRemoteAiResults] = useState<DetectionResult[]>([]);
  const [isRemoteAiReady, setIsRemoteAiReady] = useState(false);
  const [showNoFaceWarning, setShowNoFaceWarning] = useState(false);
  const noFaceStartRef = useRef<number | null>(null);
  const noFaceForfeitSentRef = useRef(false);
  const NO_FACE_WARNING_MS = 3000;
  const NO_FACE_FORFEIT_MS = 6000;

  const isMyTurn = attackerId === myUserId;

  // Derived participant info
  const opponentInfo = participants?.find(p => p.userId !== myUserId);

  // --- AI Smile Detector Setup ---
  useEffect(() => {
    const setupDetector = async () => {
      console.log('[AI] Smile Detector 초기화 시작');
      detectorRef.current = new SmileDetector();
      try {
        await detectorRef.current.initialize();
        setIsAiReady(true);
        console.log('[AI] Smile Detector 초기화 성공');
      } catch (error) {
        console.error('[AI] Smile Detector 초기화 실패:', error);
      }
    };
    setupDetector();

    return () => {
      detectorRef.current?.dispose();
      detectorRef.current = null;
      console.log('[AI] Smile Detector 정리');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const setupRemoteDetector = async () => {
      if (!isMyTurn || remoteDetectorRef.current) return;
      remoteDetectorRef.current = new SmileDetector();
      try {
        await remoteDetectorRef.current.initialize();
        if (!cancelled) {
          setIsRemoteAiReady(true);
        }
      } catch (error) {
        console.error('[AI] Remote Smile Detector 초기화 실패:', error);
        remoteDetectorRef.current?.dispose();
        remoteDetectorRef.current = null;
      }
    };

    setupRemoteDetector();

    return () => {
      cancelled = true;
    };
  }, [isMyTurn]);

  useEffect(() => {
    return () => {
      remoteDetectorRef.current?.dispose();
      remoteDetectorRef.current = null;
    };
  }, []);

  // --- Smile + Face Detection Logic ---
  useEffect(() => {
    if (!isAiReady || !localVideoRef.current || isMyTurn || showCountdown || showTurnResultModal) {
      detectorRef.current?.stop();
      setShowNoFaceWarning(false);
      noFaceStartRef.current = null;
      return;
    }

    const videoEl = localVideoRef.current;
    console.log('[AI] Face detection started');

    detectorRef.current?.start(videoEl, (results) => {
      setAiResults(results);

      const isVideoReady = videoEl.readyState >= 2;
      if (!isVideoReady || showCountdown || isMyTurn) {
        noFaceStartRef.current = null;
        setShowNoFaceWarning(false);
      } else {
        const hasFace = results.length > 0;
        if (hasFace) {
          noFaceStartRef.current = null;
          noFaceForfeitSentRef.current = false;
          setShowNoFaceWarning(false);
        } else {
          if (noFaceStartRef.current === null) {
            noFaceStartRef.current = performance.now();
          }
          const elapsed = performance.now() - noFaceStartRef.current;
          if (elapsed >= NO_FACE_WARNING_MS) {
            setShowNoFaceWarning(true);
          }
          if (elapsed >= NO_FACE_FORFEIT_MS && !noFaceForfeitSentRef.current) {
            noFaceForfeitSentRef.current = true;

            if (timerIntervalRef.current) {
              window.clearInterval(timerIntervalRef.current);
            }

            if (stompClient?.current?.connected && roomId) {
              stompClient.current.send(
                `/publish/${roomId}`,
                JSON.stringify({
                  type: 'REQUEST_SURRENDER',
                  message: 'NO_FACE',
                  data: { reason: 'NO_FACE', userId: myUserId },
                }),
              );
            }

            if (sessionRef.current) {
              sessionRef.current.disconnect();
              sessionRef.current = null;
            }
            setSession(null);
            setPublisher(null);
            setSubscriber(null);
          }
        }
      }

      if (!isMyTurn) {
        const smilingResult = results.find(r => r.isSmiling);
        if (smilingResult && !turnSwapSentRef.current) {
          console.log('[AI] 웃음 감지! REQUEST_LAUGHED 전송 (확률:', Math.round(smilingResult.smileProb * 100), '%)');
          turnSwapSentRef.current = true;

          if (stompClient?.current?.connected && roomId) {
            stompClient.current.send(
              `/publish/${roomId}`,
              JSON.stringify({ type: 'REQUEST_LAUGHED', message: null, data: null }),
            );
            console.log('[Battle] REQUEST_LAUGHED 전송 완료');
          } else {
            console.warn('[Battle] WebSocket 연결 실패, 재전송 대기');
            setTimeout(() => {
              if (stompClient?.current?.connected && roomId) {
                stompClient.current.send(
                  `/publish/${roomId}`,
                  JSON.stringify({ type: 'REQUEST_LAUGHED', message: null, data: null }),
                );
                console.log('[Battle] REQUEST_LAUGHED 재전송 완료');
              }
            }, 200);
          }
        }
      }
    });

    return () => {
      console.log('[AI] Face detection stopped');
      detectorRef.current?.stop();
      setShowNoFaceWarning(false);
      noFaceStartRef.current = null;
    };
  }, [
    isMyTurn,
    isAiReady,
    stompClient,
    roomId,
    showCountdown,
    showTurnResultModal,
    myUserId,
    NO_FACE_WARNING_MS,
    NO_FACE_FORFEIT_MS,
  ]);

  useEffect(() => {
    if (!isMyTurn || !isRemoteAiReady || !remoteVideoRef.current || showCountdown || showTurnResultModal) {
      remoteDetectorRef.current?.stop();
      setRemoteAiResults([]);
      return;
    }

    const videoEl = remoteVideoRef.current;
    console.log('[AI] Remote face detection started');

    remoteDetectorRef.current?.start(videoEl, (results) => {
      setRemoteAiResults(results);
    });

    return () => {
      console.log('[AI] Remote face detection stopped');
      remoteDetectorRef.current?.stop();
      setRemoteAiResults([]);
    };
  }, [isMyTurn, isRemoteAiReady, showCountdown, showTurnResultModal, subscriber]);


  // --- OpenVidu Setup ---
  useEffect(() => {
    if (!token) return;

    const OV = new OpenVidu();
    OV.enableProdMode();

    // RTCPeerConnection 패치: TURN URL에 TCP 트랜스포트 추가
    // (OpenVidu가 제공하는 credentials는 유지하면서 transport만 추가)
    const OriginalRTCPeerConnection = window.RTCPeerConnection;
    window.RTCPeerConnection = function (config?: RTCConfiguration) {
      if (config?.iceServers) {
        config.iceServers = config.iceServers.map(server => {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
          const patchedUrls: string[] = [];

          urls.forEach(url => {
            if (typeof url === 'string' && url.startsWith('turn:') && !url.includes('transport=')) {
              // UDP와 TCP 모두 추가 (UDP 실패 시 TCP로 폴백)
              patchedUrls.push(`${url}?transport=udp`);
              patchedUrls.push(`${url}?transport=tcp`);
            } else {
              patchedUrls.push(url);
            }
          });

          return { ...server, urls: patchedUrls };
        });
      }
      return new OriginalRTCPeerConnection(config);
    } as unknown as typeof RTCPeerConnection;

    // 원본 prototype 복사
    window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;

    const newSession = OV.initSession();

    newSession.on('streamCreated', (event) => {
      const sub = newSession.subscribe(event.stream, undefined);
      setSubscriber(sub);
    });

    newSession.on('streamDestroyed', () => {
      setSubscriber(null);
    });

    newSession.connect(token)
      .then(() => {
        const pub = OV.initPublisher(undefined, {
          videoSource: currentCameraId || undefined,
          audioSource: currentMicId || undefined,
          publishAudio: true,
          publishVideo: true,
          resolution: '1280x720',
          frameRate: 30,
          mirror: true,
        });
        newSession.publish(pub);
        setPublisher(pub);
        setSession(newSession);
        sessionRef.current = newSession;
      })
      .catch((error) => {
        console.error('OpenVidu 연결 오류:', error);
      });

    return () => {
      if (sessionRef.current) {
        sessionRef.current.disconnect();
      }
    };
  }, [token]);

  // Attach publisher video to local element
  useEffect(() => {
    if (publisher && localVideoRef.current) {
      publisher.addVideoElement(localVideoRef.current);
    }
  }, [publisher]);

  // Attach subscriber video to remote element
  useEffect(() => {
    if (subscriber && remoteVideoRef.current) {
      subscriber.addVideoElement(remoteVideoRef.current);
    }
  }, [subscriber]);

  // --- sendGameEvent ---
  const sendGameEvent = useCallback((type: string, extraMessage: string | null = null, data: unknown = null) => {
    if (stompClient?.current?.connected && roomId) {
      console.log('[Battle] sending:', type);
      stompClient.current.send(
        `/publish/${roomId}`,
        JSON.stringify({ type, message: extraMessage, data }),
      );
    }
  }, [roomId, stompClient]);

  // --- Disconnect OpenVidu helper ---
  const disconnectSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
      setSession(null);
      setPublisher(null);
      setSubscriber(null);
    }
  }, []);

  // 로그아웃 감지 → 즉시 로비로 이동
  useEffect(() => {
    if (!accessToken) {
      allowNavigationRef.current = true;
      disconnectSession();
      navigate('/');
    }
  }, [accessToken, disconnectSession, navigate]);

  // --- 60s turn timer ---
  const startTimer = () => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
    }
    // 새 턴 타이머 시작 시 이전 턴 플래그 리셋
    turnSwapSentRef.current = false;
    turnSwapLockRef.current = false;

    timerIntervalRef.current = window.setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          if (timerIntervalRef.current) {
            window.clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          return 0;
        }
        return newTime;
      });
    }, 1000);
  };

  // --- Turn countdown (3-2-1 then start timer) ---
  const startTurnCountdown = useCallback(() => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    // 카운트다운 시작 시 이전 턴 플래그 리셋
    turnSwapSentRef.current = false;
    turnSwapLockRef.current = true;

    setShowCountdown(true);
    setCountdownNumber(3);
    setTimeRemaining(60);

    let count = 3;
    const countdownInterval = window.setInterval(() => {
      count--;
      if (count === 0) {
        window.clearInterval(countdownInterval);
        setShowCountdown(false);
        startTimer();
        // countdown 종료 후 500ms 뒤에 lock 해제 (race condition 방지)
        setTimeout(() => {
          turnSwapLockRef.current = false;
        }, 500);
      } else {
        setCountdownNumber(count);
      }
    }, 1000);
  }, []);

  // Initial turn countdown on mount
  useEffect(() => {
    startTurnCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- WebSocket subscription ---
  const handleSocketMessage = useCallback((payload: { type: string; message: string; data: Record<string, unknown> | null }) => {
    console.log('[Battle] 메세지 수신:', payload);

    switch (payload.type) {
      case 'RESPONSE_TURN_SWAP':
      case 'RESPONSE_ROUND_END': {
        // 기존 타이머 강제 정지 (race condition 방지)
        if (timerIntervalRef.current) {
          window.clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        if (payload.data) {
          const data = payload.data as {
            reason?: string;
            attackerId?: string;
            currentTurn?: number;
            currentRound?: number;
            currentScores?: Record<string, number>;
          };

          // reason 필드로 공격 성공 여부 판정
          // REQUEST_LAUGHED = 수비자가 웃음 (공격 성공), REQUEST_TURN_SWAP = 타이머 만료 (공격 실패)
          const attackSuccess = data.reason === 'REQUEST_LAUGHED';
          const previousAttacker = attackerId;

          // 턴 결과 기록
          setTurnHistory(prev => [...prev, {
            turnNumber: turn,
            attackerId: previousAttacker,
            success: attackSuccess,
          }]);

          // 턴 결과 모달 설정
          const wasAttacker = previousAttacker === myUserId;
          setLastTurnResult({ wasAttacker, success: attackSuccess });
          setShowTurnResultModal(true);

          if (data.attackerId) setAttackerId(data.attackerId);
          if (data.currentTurn !== undefined) setTurn(data.currentTurn);
          if (data.currentRound !== undefined) setRound(data.currentRound);
          if (data.currentScores) setScores(data.currentScores);
          turnSwapSentRef.current = false;
          turnSwapLockRef.current = true; // lock 설정 (countdown 종료 후 해제)

          // 모달 3초 표시 후 카운트다운 시작
          if (turnResultTimerRef.current) {
            window.clearTimeout(turnResultTimerRef.current);
          }
          turnResultTimerRef.current = window.setTimeout(() => {
            setShowTurnResultModal(false);
            setLastTurnResult(null);
            turnResultTimerRef.current = null;
            startTurnCountdown();
          }, 3000);
        }
        break;
      }
      case 'RESPONSE_BATTLE_END': {
        if (timerIntervalRef.current) {
          window.clearInterval(timerIntervalRef.current);
        }
        disconnectSession();
        const data = payload.data as {
          winnerId?: string;
          finalScores?: Record<string, number>;
        } | null;
        navigate('/battle-result', {
          state: {
            winnerId: data?.winnerId || '',
            finalScores: data?.finalScores || scores,
            participants: participants || [],
          },
        });
        break;
      }
      case 'RESPONSE_ROOM_DESTROYED': {
        if (timerIntervalRef.current) {
          window.clearInterval(timerIntervalRef.current);
        }
        disconnectSession();
        // The remaining player wins
        navigate('/battle-result', {
          state: {
            winnerId: myUserId || '',
            finalScores: scores,
            participants: participants || [],
          },
        });
        break;
      }
      case 'RESPONSE_REPORTED': {
        // 신고당한 경우 처리
        const data = payload.data as { reportedUserId?: string } | null;
        if (data?.reportedUserId === myUserId) {
          // 내가 신고당함
          if (timerIntervalRef.current) {
            window.clearInterval(timerIntervalRef.current);
          }
          disconnectSession();
          allowNavigationRef.current = true;
          navigate('/', { state: { wasReported: true } });
        }
        break;
      }
      default:
        console.log('[Battle] 알 수 없는 메세지:', payload);
        break;
    }
  }, [disconnectSession, navigate, scores, participants, myUserId, attackerId, turn, startTurnCountdown]);

  useEffect(() => {
    if (!isConnected || !stompClient?.current?.connected || !roomId) return;

    console.log(`[Battle] ${roomId}번 방 구독 시작`);
    const subscription = stompClient.current.subscribe(`/topic/${roomId}`, (msg) =>
      handleSocketMessage(JSON.parse(msg.body)),
    );

    const errorSubscription = stompClient.current.subscribe(
      `/user/queue/errors/${roomId}`,
      (message) => {
        const errorData = JSON.parse(message.body);
        console.error('[Battle] 오류:', errorData.message);
      },
    );

    return () => {
      if (stompClient.current?.connected) {
        subscription.unsubscribe();
        errorSubscription.unsubscribe();
      }
    };
  }, [isConnected, roomId, stompClient, handleSocketMessage]);

  // When timer hits 0, attacker sends REQUEST_TURN_SWAP
  useEffect(() => {
    if (
      timeRemaining === 0 &&
      !showCountdown &&
      isMyTurn &&
      !turnSwapSentRef.current &&
      !turnSwapLockRef.current // lock 상태에서는 전송 차단
    ) {
      turnSwapSentRef.current = true;
      turnSwapLockRef.current = true;
      sendGameEvent('REQUEST_TURN_SWAP');
    }
  }, [timeRemaining, showCountdown, isMyTurn, sendGameEvent]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
      }
      if (turnResultTimerRef.current) {
        window.clearTimeout(turnResultTimerRef.current);
      }
    };
  }, []);

  // --- 포커스 5초 미복귀 시 자동 패배 ---
  useEffect(() => {
    if (!focusTimedOut) return;
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
    }
    sendGameEvent('REQUEST_SURRENDER');
    // 백엔드에서 RESPONSE_BATTLE_END가 오면 handleSocketMessage에서 결과 화면으로 이동
  }, [focusTimedOut, sendGameEvent]);

  // --- Button handlers ---
  const handleEndTurn = () => {
    if (isMyTurn && timeRemaining > 0 && !showCountdown && !turnSwapSentRef.current && !turnSwapLockRef.current) {
      turnSwapSentRef.current = true;
      turnSwapLockRef.current = true;
      sendGameEvent('REQUEST_TURN_SWAP');
    }
  };

  const handleQuit = () => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
    }
    sendGameEvent('REQUEST_SURRENDER');
    disconnectSession();

    if (blocker.state === 'blocked') {
      // Navigation was intercepted (nav bar click) — proceed to the original destination
      blocker.proceed();
    } else {
      // Direct "게임 종료" button — navigate to home
      allowNavigationRef.current = true;
      navigate('/');
    }
  };

  const handleCancelQuit = () => {
    setShowQuitModal(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  // --- Report handlers ---
  const handleOpenReportModal = () => {
    setShowReportModal(true);
    setReportReason('');
    setReportDetail('');
  };

  const handleCancelReport = () => {
    setShowReportModal(false);
    setReportReason('');
    setReportDetail('');
  };

  const handleSubmitReport = async () => {
    if (!reportReason) return;
    if (reportReason === 'OTHER' && !reportDetail.trim()) return;
    if (!opponentInfo?.nickname) return;

    setIsReporting(true);

    try {
      // POST /api/reports 호출
      await api.post('/reports', {
        targetNickname: opponentInfo.nickname,
        reason: reportReason,
        detail: reportReason === 'OTHER' ? reportDetail.trim() : (reportDetail.trim() || null),
      });

      // REQUEST_REPORT 웹소켓 전송
      if (stompClient?.current?.connected && roomId) {
        stompClient.current.send(
          `/publish/${roomId}`,
          JSON.stringify({ type: 'REQUEST_REPORT', message: null, data: null }),
        );
      }

      // 타이머 정지 및 세션 정리
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
      }
      disconnectSession();

      // 로비로 이동 (신고 접수 메시지 전달)
      allowNavigationRef.current = true;
      navigate('/', { state: { reportSubmitted: true } });
    } catch (error) {
      console.error('신고 실패:', error);
      alert('신고 접수에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsReporting(false);
    }
  };

  const isReportFormValid = reportReason !== '' && (reportReason !== 'OTHER' || reportDetail.trim().length > 0);

  // --- UI helpers ---
  const getTurnText = () => {
    if (showCountdown) return '준비';
    return isMyTurn ? '공격' : '방어';
  };

  const getGameInfo = () => {
    if (showCountdown) return '곧 시작됩니다!';
    return isMyTurn
      ? '공격 차례입니다! 상대를 제압하세요!'
      : '방어 차례입니다! 공격을 막아내세요!';
  };

  const getMyVideoBorderStyle = () => {
    if (showCountdown) return '';
    // 방어 턴일 때 웃고 있으면 녹색 테두리
    if (!isMyTurn && aiResults.some(r => r.isSmiling)) {
      return 'md:shadow-[0_0_0_4px_#34D399]';
    }
    return isMyTurn
      ? 'md:shadow-[0_0_0_4px_#ff4444]'
      : 'md:shadow-[0_0_0_4px_#44ff44]';
  };

  const getOpponentVideoBorderStyle = () => {
    if (showCountdown) return '';
    return isMyTurn
      ? 'md:shadow-[0_0_0_4px_#44ff44]'
      : 'md:shadow-[0_0_0_4px_#ff4444]';
  };

  const getTurnIndicatorStyle = () => {
    if (showCountdown) return 'border-gray-600 text-gray-600';
    return isMyTurn
      ? 'border-red-500 text-red-500'
      : 'border-green-500 text-green-500';
  };

  const defenderSmileProb = isMyTurn
    ? (remoteAiResults[0]?.smileProb ?? 0)
    : (aiResults[0]?.smileProb ?? 0);
  const isDefenderSmileReady = isMyTurn ? isRemoteAiReady : isAiReady;

  // 승부차기 스타일 점수판 데이터
  const myAttackResults = turnHistory.filter(t => t.attackerId === myUserId);
  const opponentAttackResults = turnHistory.filter(t => t.attackerId !== myUserId);

  return (
    <div className="bg-black text-white w-full flex-1 font-sans flex flex-col relative overflow-hidden md:overflow-visible">
      <div className="flex flex-col md:flex-row justify-center items-center px-0 md:px-[clamp(16px,3vw,40px)] py-0 md:py-[clamp(16px,3vh,40px)] gap-0 md:gap-[clamp(16px,3vw,32px)] flex-1 w-full h-full md:h-auto z-10 pointer-events-none md:pointer-events-auto">
        {/* My video + scoreboard */}
        <div className="absolute top-4 right-4 z-50 w-[28vw] max-w-[120px] md:static md:w-full md:max-w-none md:flex-1 md:min-w-0 flex flex-col items-center pointer-events-auto transition-all duration-300">
          <div className={`relative w-full aspect-[3/4] md:aspect-[4/3] rounded-xl md:rounded-3xl overflow-hidden transition-all duration-300 shadow-lg ${getMyVideoBorderStyle()}`}
            style={{ background: 'linear-gradient(45deg, #2a2a2a 25%, #3a3a3a 25%, #3a3a3a 50%, #2a2a2a 50%, #2a2a2a 75%, #3a3a3a 75%, #3a3a3a)', backgroundSize: '40px 40px' }}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {showNoFaceWarning && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div className="bg-red-600/30 text-white text-center px-6 py-3 text-sm font-bold rounded-lg shadow-lg">
                  얼굴이 감지되지 않습니다. 3초 내로 얼굴을 화면에 보여주세요. 3초 뒤 자동 패배합니다.
                </div>
              </div>
            )}
            <div className="absolute bottom-5 left-5 bg-black/60 px-3 py-1 rounded text-white text-sm">
              나
            </div>
            <div className="absolute top-5 right-5 flex gap-1">
              <div className="w-1 h-2 bg-white rounded-sm"></div>
              <div className="w-1 h-3 bg-white rounded-sm"></div>
              <div className="w-1 h-4 bg-white rounded-sm"></div>
            </div>
          </div>
          {/* 내 공격 결과 점수판 */}
          <div className="flex gap-2 mt-3 h-8 items-center">
            {myAttackResults.map((result, idx) => (
              <span key={idx} className={`text-xl font-bold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? 'O' : 'X'}
              </span>
            ))}
          </div>
        </div>

        {/* Center score section */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 md:static md:translate-x-0 text-center min-w-[200px] pointer-events-none md:pointer-events-auto">
          <div className="text-7xl font-bold mb-2 drop-shadow-lg">{timeRemaining}</div>
          <div className={`inline-block px-6 py-2 rounded-full text-lg font-bold border-2 transition-colors duration-300 shadow-lg ${getTurnIndicatorStyle()} bg-black/30 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none`}>
            {getTurnText()}
          </div>
          <div className="text-sm text-gray-200 md:text-gray-500 mt-2 drop-shadow-md">R{round} · T{turn}</div>
          <div className="text-lg font-bold mt-5 h-10 flex items-center justify-center drop-shadow-md text-white">
            {getGameInfo()}
          </div>
          {!showCountdown && isDefenderSmileReady && (
            <div className="text-sm text-white/80 mt-2 drop-shadow-md">
              웃음 감지: {Math.round(defenderSmileProb * 100)}%
            </div>
          )}
        </div>

        {/* Opponent video + scoreboard */}
        <div className="fixed inset-0 z-0 w-full h-full md:static md:w-full md:h-auto md:flex-1 md:min-w-0 flex flex-col items-center pointer-events-auto">
          <div className={`relative w-full h-full md:aspect-[4/3] rounded-none md:rounded-3xl overflow-hidden transition-all duration-300 ${getOpponentVideoBorderStyle()}`}
            style={{ background: 'linear-gradient(45deg, #2a2a2a 25%, #3a3a3a 25%, #3a3a3a 50%, #2a2a2a 50%, #2a2a2a 75%, #3a3a3a 75%, #3a3a3a)', backgroundSize: '40px 40px' }}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!subscriber && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-lg">
                <h3>상대방 영상 연결 대기...</h3>
              </div>
            )}
            <div className="absolute bottom-5 left-5 bg-black/60 px-3 py-1 rounded text-white text-sm">
              {opponentInfo?.nickname || '상대'}
            </div>
            <div className="absolute top-5 right-5 flex gap-1">
              <div className="w-1 h-2 bg-white rounded-sm"></div>
              <div className="w-1 h-3 bg-white rounded-sm"></div>
              <div className="w-1 h-4 bg-white rounded-sm"></div>
            </div>
          </div>
          {/* 상대 공격 결과 점수판 */}
          <div className="flex gap-2 mt-3 h-8 items-center">
            {opponentAttackResults.map((result, idx) => (
              <span key={idx} className={`text-xl font-bold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? 'O' : 'X'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="fixed bottom-0 left-0 w-full z-50 flex justify-center gap-3 md:gap-5 pb-8 pt-20 bg-gradient-to-t from-black/80 to-transparent md:relative md:bg-none md:py-0 md:pb-8 pointer-events-auto">
        <button
          onClick={() => setShowQuitModal(true)}
          className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9 9h6v6H9z"></path>
          </svg>
          게임 종료
        </button>
        <button
          onClick={handleOpenReportModal}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-lg text-white text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          신고
        </button>
        <button
          onClick={handleEndTurn}
          disabled={!isMyTurn || timeRemaining <= 0 || showCountdown}
          className={`px-6 py-3 rounded-lg text-sm font-bold transition-colors ${isMyTurn && timeRemaining > 0 && !showCountdown
              ? 'bg-green-500 hover:bg-green-600 text-black'
              : 'bg-gray-600 text-white opacity-50 cursor-not-allowed'
            }`}
        >
          턴 넘기기
        </button>
      </div>

      {/* Quit modal */}
      {showQuitModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelQuit();
          }}
        >
          <div className="bg-[#1a1a1a] p-10 rounded-3xl text-center max-w-md">
            <div className="text-2xl font-bold mb-4">게임을 종료하시겠습니까?</div>
            <div className="text-gray-400 mb-8 leading-relaxed">
              게임을 종료하면 이번 매칭에서 패배하게 됩니다.<br />
              정말 종료하시겠습니까?
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleCancelQuit}
                className="px-8 py-3 bg-[#333] hover:bg-[#444] text-white rounded-lg font-bold transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleQuit}
                className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-colors"
              >
                종료하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {showReportModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelReport();
          }}
        >
          <div className="bg-[#1a1a1a] p-8 rounded-3xl max-w-md w-full mx-4">
            <div className="text-2xl font-bold mb-2 text-center">신고하기</div>
            <div className="text-gray-400 text-sm mb-6 text-center">
              {opponentInfo?.nickname || '상대'}님을 신고합니다
            </div>

            {/* 신고 사유 선택 */}
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-2">신고 사유</label>
              <div className="space-y-2">
                {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${reportReason === reason
                        ? 'bg-orange-500/20 border border-orange-500'
                        : 'bg-[#2a2a2a] border border-transparent hover:bg-[#333]'
                      }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={reason}
                      checked={reportReason === reason}
                      onChange={(e) => setReportReason(e.target.value as ReportReason)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${reportReason === reason ? 'border-orange-500' : 'border-gray-500'
                        }`}
                    >
                      {reportReason === reason && (
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      )}
                    </div>
                    <span className="text-white text-sm">{REPORT_REASON_LABELS[reason]}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 상세 내용 입력 */}
            <div className="mb-6">
              <label className="block text-sm text-gray-300 mb-2">
                상세 내용 {reportReason === 'OTHER' && <span className="text-orange-500">(필수)</span>}
              </label>
              <textarea
                value={reportDetail}
                onChange={(e) => setReportDetail(e.target.value.slice(0, 500))}
                placeholder="상세 내용을 입력해주세요 (최대 500자)"
                className="w-full h-24 bg-[#2a2a2a] text-white rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <div className="text-right text-xs text-gray-500 mt-1">
                {reportDetail.length}/500
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-4">
              <button
                onClick={handleCancelReport}
                className="flex-1 px-6 py-3 bg-[#333] hover:bg-[#444] text-white rounded-lg font-bold transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={!isReportFormValid || isReporting}
                className={`flex-1 px-6 py-3 rounded-lg font-bold transition-colors ${isReportFormValid && !isReporting
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
              >
                {isReporting ? '신고 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Turn result modal */}
      {showTurnResultModal && lastTurnResult && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[2000]">
          <div className="bg-[#1a1a1a] p-10 rounded-3xl text-center max-w-md">
            <div className={`text-2xl font-bold ${(lastTurnResult.wasAttacker ? lastTurnResult.success : !lastTurnResult.success)
                ? 'text-green-400'
                : 'text-red-400'
              }`}>
              {lastTurnResult.wasAttacker
                ? lastTurnResult.success
                  ? `${opponentInfo?.nickname || '상대'}님을 웃기는데 성공했습니다!`
                  : `${opponentInfo?.nickname || '상대'}님을 웃기는데 실패했습니다.`
                : lastTurnResult.success
                  ? '웃음을 참는데 실패했습니다.'
                  : '웃음을 참아내는데 성공했습니다!'
              }
            </div>
          </div>
        </div>
      )}

      {/* Turn countdown overlay */}
      {showCountdown && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[2000]">
          <div className="text-[120px] font-bold text-white animate-pulse">
            {countdownNumber === 0 ? '시작!' : countdownNumber}
          </div>
          <div className="text-3xl text-gray-400 mt-5">
            {isMyTurn
              ? '공격 차례입니다!'
              : '상대방의 공격입니다!'}
          </div>
        </div>
      )}
      {/* 포커스 잃음 감지 — 화면 가림 */}
      {blurred && (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[9999]">
          <p className="text-white text-xl">다른 작업 중에는 화면이 가려집니다. 👾</p>
          {focusWarning && (
            <p className="text-red-500 text-2xl font-bold mt-4 animate-pulse">
              5초 안에 돌아오지 않으면 게임에서 패배하게 됩니다!
            </p>
          )}
        </div>
      )}
      <CaptureWarningModal open={captureOpen} onClose={captureClose} />
    </div>
  );
};

export default BattleGame;
