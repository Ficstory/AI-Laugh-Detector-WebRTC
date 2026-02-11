import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

const Countdown: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const [count, setCount] = useState<number>(3);
  const [isGameStart, setIsGameStart] = useState<boolean>(false);

  // 랜덤 TIP 리스트 (유머러스한 톤 유지)
  const tips = [
    "바다에 소를 데려가면 안되는 이유는? (수영해소)",
    "세상에서 가장 무서운 전화기는? (무서워폰)",
    "매칭 대기 중에는 매너를 지켜주세요!",
    "상대방의 얼굴을 보며 환하게 웃어보세요.",
    "가장 억울한 도형은? (원통)",
    "왕이 넘어지면? (킹콩)" 
  ];

  // 컴포넌트가 마운트될 때 딱 한 번 랜덤하게 팁을 선택합니다.
  const [randomTip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);

  useEffect(() => {
    if (count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsGameStart(true);
      const finishTimer = setTimeout(() => {
        // 게임 시작 후 Battle 화면으로 이동
        navigate(`/battle/${roomId}`, { state: location.state });
      }, 1500); // 1.5초간 "BATTLE START!" 노출
      return () => clearTimeout(finishTimer);
    }
  }, [count, navigate, roomId, location.state]);

  // 애니메이션 키에 따른 변화 (3 -> 2 -> 1 -> START)
  const animKey = isGameStart ? 'start' : count;

  return (
    <div className="fixed inset-0 bg-black z-[2000] flex flex-col items-center justify-center overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00ff88]/5 rounded-full blur-[100px] animate-pulse" />
      </div>

      {/* Styles for Custom Animations */}
      <style>{`
        @keyframes shockwave {
          0% { transform: scale(3); opacity: 0; filter: blur(20px); }
          50% { transform: scale(1); opacity: 1; filter: blur(0px); }
          100% { transform: scale(0.9); opacity: 0; filter: blur(10px); }
        }
        @keyframes pop-in {
          0% { transform: scale(0.5); opacity: 0; filter: blur(10px); }
          70% { transform: scale(1.1); opacity: 1; filter: blur(0px); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-count {
            animation: shockwave 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-gamestart {
            animation: pop-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      {/* Main Countdown Center */}
      <div className="relative z-10 flex-1 flex items-center justify-center">
        {isGameStart ? (
             <div className="relative animate-gamestart text-center">
                <h1 
                    className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#00ff88] to-emerald-500 drop-shadow-[0_0_50px_rgba(0,255,136,0.6)] tracking-tighter"
                    style={{ fontFamily: 'Yeongdo-Regular, sans-serif' }}
                >
                    BATTLE<br/>START
                </h1>
             </div>
        ) : (
            <div key={count} className="relative animate-count">
                <span 
                    className="text-[15rem] md:text-[20rem] leading-none font-black text-[#00ff88] drop-shadow-[0_0_50px_rgba(0,255,136,0.6)]"
                    style={{ fontFamily: 'Yeongdo-Regular, sans-serif' }}
                >
                    {count}
                </span>
                {/* Echo Effect */}
                <span 
                    className="absolute inset-0 text-[15rem] md:text-[20rem] leading-none font-black text-[#00ff88] opacity-30 blur-xl animate-pulse"
                    style={{ fontFamily: 'Yeongdo-Regular, sans-serif' }}
                >
                    {count}
                </span>
            </div>
        )}
      </div>

      {/* Footer Tip Section */}
      <div className="relative z-10 mb-20 animate-[fadeInUp_1s_ease-out]">
        <div className="px-8 py-4 bg-white/5 backdrop-blur-md rounded-full border border-white/10 flex flex-col items-center gap-2 max-w-lg mx-auto text-center shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
            <span className="text-[#00ff88] text-xs font-bold tracking-[0.2em] uppercase">Today's Tip</span>
            <p className="text-white/80 text-lg md:text-xl font-medium break-keep leading-snug">
                "{randomTip}"
            </p>
        </div>
      </div>

    </div>
  );
};

export default Countdown;