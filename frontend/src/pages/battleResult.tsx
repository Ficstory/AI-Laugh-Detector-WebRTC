import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaUserCircle } from 'react-icons/fa';
import { userStore } from '../stores/userStore';

type ResultType = 'victory' | 'defeat' | 'draw';

interface BattleResultState {
  winnerId: string;
  finalScores: Record<string, number>;
  participants: Array<{
    userId: string;
    nickname: string;
    profileImageUrl?: string | null;
  }>;
}

export default function BattleResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: myUserId } = userStore();

  const state = (location.state || {}) as Partial<BattleResultState>;
  const { winnerId = '', finalScores = {}, participants = [] } = state;

  const result: ResultType = winnerId === ''
    ? 'draw'
    : winnerId === myUserId
      ? 'victory'
      : 'defeat';

  const [showMessage, setShowMessage] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // 내 카메라 스트림 가져오기
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error('카메라 접근 실패:', err);
      });

    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    setShowMessage(false);
    setAnimationKey(prev => prev + 1);

    const timer = setTimeout(() => {
      setShowMessage(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [result]);

  const handleGoBack = () => {
    navigate('/');
  };

  const getWinnerNickname = () => {
    const winner = participants.find(p => p.userId === winnerId);
    return winner?.nickname || '알 수 없음';
  };

  const getLoserNickname = () => {
    const loser = participants.find(p => p.userId !== winnerId);
    return loser?.nickname || '알 수 없음';
  };

  const myInfo = participants.find(p => p.userId === myUserId);
  const opponentInfo = participants.find(p => p.userId !== myUserId);

  const myScore = myUserId ? (finalScores[myUserId] ?? 0) : 0;
  const opponentScore = opponentInfo ? (finalScores[opponentInfo.userId] ?? 0) : 0;

  const getMyBorder = () => {
    if (result === 'victory') return 'border-green-500';
    if (result === 'draw') return 'border-green-500';
    return '';
  };

  const getOpponentBorder = () => {
    if (result === 'defeat') return 'border-gray-500';
    if (result === 'draw') return 'border-green-500';
    return '';
  };

  return (
    <div className="w-full flex-1 bg-black flex flex-col overflow-hidden">
      <style>{`
        @keyframes prisonDrop {
          0% { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 1; }
          50% { transform: translateY(0); }
          60% { transform: translateY(-5%); }
          70% { transform: translateY(0); }
          80% { transform: translateY(-2%); }
          100% { transform: translateY(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .prison-bars-animate {
          animation: prisonDrop 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .fade-in {
          animation: fadeIn 0.5s ease-in forwards;
        }
      `}</style>

      {/* Battle Area */}
      <div className="flex-1 flex items-center justify-center gap-8 px-8 relative">
        {/* Victory/Defeat Message Overlay */}
        {showMessage && result !== 'draw' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 fade-in bg-black/85">
            <div className="text-center mb-8">
              <h1 className="text-white text-5xl mb-4">
                <span className="font-bold">{`${getWinnerNickname()}`}</span>님께서{' '}
                <span className="text-green-400 font-bold">승리</span>하셨습니다.
              </h1>
              <p className="text-gray-400 text-xl">
                {getLoserNickname()}님은 {getWinnerNickname()}님보다 재미없는 사람입니다
              </p>
            </div>
            <button
              onClick={handleGoBack}
              className="bg-white text-black px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-colors"
            >
              <span className="font-medium">돌아가기</span>
            </button>
          </div>
        )}

        {/* Draw Message Overlay */}
        {showMessage && result === 'draw' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 fade-in bg-black/85">
            <div className="text-center mb-8 max-w-2xl">
              <div className="text-6xl mb-6">🤝</div>
              <h1 className="text-white text-6xl font-bold mb-8">무승부</h1>
              <p className="text-gray-300 text-xl mb-2">
                양 플레이어가 대등한 실력을 보여주었습니다.
              </p>
            </div>
            <button
              onClick={handleGoBack}
              className="bg-white text-black px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-colors mt-6"
            >
              <span className="font-medium">돌아가기</span>
            </button>
          </div>
        )}

        {/* Player 1 - Me (Left) */}
        <div className={`relative flex-1 min-w-0 ${
          result === 'victory'
            ? 'border-4 rounded-2xl ' + getMyBorder()
            : result === 'draw'
            ? 'border-4 rounded-2xl border-green-500'
            : ''
        }`}>
          <div className="aspect-[4/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden relative">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Prison bars overlay for defeat */}
            {result === 'defeat' && (
              <div key={`defeat-${animationKey}`} className="absolute inset-0 bg-black/20 prison-bars-animate">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{stopColor: '#555', stopOpacity: 1}} />
                      <stop offset="50%" style={{stopColor: '#888', stopOpacity: 1}} />
                      <stop offset="100%" style={{stopColor: '#555', stopOpacity: 1}} />
                    </linearGradient>
                  </defs>
                  {[...Array(12)].map((_, i) => (
                    <g key={i}>
                      <rect
                        x={`${(i * 100) / 12}%`}
                        y="0"
                        width="4%"
                        height="100%"
                        fill="url(#barGradient)"
                        stroke="#333"
                        strokeWidth="2"
                      />
                      <rect
                        x={`${(i * 100) / 12 + 1}%`}
                        y="0"
                        width="0.5%"
                        height="100%"
                        fill="#aaa"
                        opacity="0.6"
                      />
                    </g>
                  ))}
                </svg>
              </div>
            )}

            {/* Score overlay */}
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-white text-sm">
              {myInfo?.nickname || '나'} · {myScore}점
            </div>
          </div>

          {/* Result badge */}
          {result === 'defeat' && !showMessage && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
              <div className="bg-red-500 text-white px-8 py-3 rounded-full border-4 border-red-700 font-bold text-xl" style={{animation: 'fadeIn 0.5s ease-in 0.8s both'}}>
                패배
              </div>
            </div>
          )}
          {result === 'victory' && !showMessage && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
              <div className="bg-green-500 text-white px-8 py-3 rounded-full border-4 border-green-700 font-bold text-xl" style={{animation: 'fadeIn 0.5s ease-in 0.3s both'}}>
                승리
              </div>
            </div>
          )}
        </div>

        {/* VS Text */}
        <div className="text-white text-6xl font-bold">
          결과
        </div>

        {/* Player 2 - Opponent (Right) */}
        <div className={`relative flex-1 min-w-0 ${
          result === 'defeat'
            ? 'border-4 rounded-2xl ' + getOpponentBorder()
            : result === 'draw'
            ? 'border-4 rounded-2xl border-green-500'
            : ''
        }`}>
          <div className="aspect-[4/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden relative">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {opponentInfo?.profileImageUrl ? (
                <img
                  src={opponentInfo.profileImageUrl}
                  alt="상대 프로필"
                  className="w-[120px] h-[120px] rounded-full object-cover"
                />
              ) : (
                <FaUserCircle className="text-[120px] text-gray-600" />
              )}
              <span className="text-gray-500 text-lg mt-4">{opponentInfo?.nickname || '상대'}</span>
            </div>

            {/* Prison bars overlay for opponent defeat (I won) */}
            {result === 'victory' && (
              <div key={`opponent-defeat-${animationKey}`} className="absolute inset-0 bg-black/20 prison-bars-animate">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="barGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{stopColor: '#555', stopOpacity: 1}} />
                      <stop offset="50%" style={{stopColor: '#888', stopOpacity: 1}} />
                      <stop offset="100%" style={{stopColor: '#555', stopOpacity: 1}} />
                    </linearGradient>
                  </defs>
                  {[...Array(12)].map((_, i) => (
                    <g key={i}>
                      <rect
                        x={`${(i * 100) / 12}%`}
                        y="0"
                        width="4%"
                        height="100%"
                        fill="url(#barGradient2)"
                        stroke="#333"
                        strokeWidth="2"
                      />
                      <rect
                        x={`${(i * 100) / 12 + 1}%`}
                        y="0"
                        width="0.5%"
                        height="100%"
                        fill="#aaa"
                        opacity="0.6"
                      />
                    </g>
                  ))}
                </svg>
              </div>
            )}

            {/* Score overlay */}
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-white text-sm">
              {opponentInfo?.nickname || '상대'} · {opponentScore}점
            </div>
          </div>

          {/* Result badge */}
          {result === 'victory' && !showMessage && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
              <div className="bg-red-500 text-white px-8 py-3 rounded-full border-4 border-red-700 font-bold text-xl" style={{animation: 'fadeIn 0.5s ease-in 0.8s both'}}>
                패배
              </div>
            </div>
          )}
          {result === 'defeat' && !showMessage && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
              <div className="bg-green-500 text-white px-8 py-3 rounded-full border-4 border-green-700 font-bold text-xl" style={{animation: 'fadeIn 0.5s ease-in 0.3s both'}}>
                승리
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
