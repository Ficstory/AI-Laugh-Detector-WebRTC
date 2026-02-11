import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';

// --- UX Writing (Context: Laughter Battle) ---
// User updated text preserved
const STEPS = [
  "접속자 목록을 확인하고 있어요",
  "웃음 코드가 맞는 상대를 찾는 중이에요",
  "매칭이 거의 다 됐어요.. 아마도..?",
];

const TIPS = [
  "TIP: 아재개그 하나 준비하셨나요? '왕이 넘어지면? 킹콩!'",
  "TIP: 꼭 얼굴로 웃길 필요 없습니다.",
  "TIP: 시작하자마자 콧구멍을 벌렁거려 보세요. 필승법입니다.",
  "TIP: 소품을 활용하면 승률이 올라갑니다.",
];

const MatchLoad: React.FC = () => {
  const navigate = useNavigate();
  
  // --- State Machine ---
  const [currentStep, setCurrentStep] = useState(0);
  const [currentTip, setCurrentTip] = useState(0);
  const [isCanceling, setIsCanceling] = useState(false); // For exit animation
  
  const hasStartedRef = useRef(false);

  // --- API Interaction ---
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const startMatch = async () => {
      try {
        await api.post('/matchmaking/start');
        console.log('Matchmaking started');
      } catch (error) {
        console.error('Failed to start matchmaking:', error);
      }
    };
    startMatch();
  }, []);

  // --- Step & Tip Rotation ---
  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    }, 10000); // 5s interval

    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % TIPS.length);
    }, 8000); // 6s interval

    return () => {
      clearInterval(stepInterval);
      clearInterval(tipInterval);
    };
  }, []);

  // --- Cancel Interaction (Click -> Animation -> Exit) ---
  const handleCancel = useCallback(async () => {
    // 1. Visually trigger cancellation immediately
    setIsCanceling(true);

    // 2. API Call (Fire and forget, or await if needed, but we want UI speed)
    try {
      await api.post('/matchmaking/cancel');
    } catch (error) {
      console.error('Cancel failed', error);
    }

    // 3. Smooth transition to home
    setTimeout(() => {
      navigate('/');
    }, 700); // Match this with CSS transition duration
  }, [navigate]);

  return (
    <div 
      className={`
        w-full h-full flex flex-col items-center justify-center p-6 relative overflow-hidden 
        transition-all duration-700 ease-in-out
        ${isCanceling ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'}
      `}
      aria-live="polite"
    >
      {/* Container to center content vertically within the frame */}
      <div className="flex flex-col items-center w-full max-w-sm gap-10">
        
        {/* 1. Loader (Rhythmic Equalizer) */}
        <div className="relative w-40 h-24 flex items-center justify-center gap-1.5">
          {/* 5 Bars representing Laughter Frequency */}
          <div className="w-1.5 bg-white/80 rounded-full animate-[equalizer_1s_ease-in-out_infinite]" style={{ animationDelay: '0s' }} />
          <div className="w-1.5 bg-white/90 rounded-full animate-[equalizer_1s_ease-in-out_infinite]" style={{ animationDelay: '0.1s' }} />
          <div className="w-1.5 bg-white rounded-full animate-[equalizer_1s_ease-in-out_infinite]" style={{ animationDelay: '0.2s' }} />
          <div className="w-1.5 bg-white/90 rounded-full animate-[equalizer_1s_ease-in-out_infinite]" style={{ animationDelay: '0.3s' }} />
          <div className="w-1.5 bg-white/80 rounded-full animate-[equalizer_1s_ease-in-out_infinite]" style={{ animationDelay: '0.4s' }} />
          
          {/* Subtle Glow Behind */}
          <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full scale-75 animate-pulse" />
        </div>

        {/* 2. Status & Context */}
        <div className="text-center space-y-2 mt-2">
          <h1 className="text-[26px] font-bold leading-tight text-white" style={{ fontFamily: 'Yeongdo-Regular, sans-serif' }}>
            딱 맞는 상대를<br />찾고 있어요
          </h1>
          
          <div className="h-6 flex items-center justify-center">
             <p key={currentStep} className="text-[15px] text-gray-400 animate-fadeInUp">
               {STEPS[currentStep]}
             </p>
          </div>
        </div>

        {/* 3. TIP (Compact & Relevant) */}
        <div className="w-full bg-white/5 rounded-xl px-4 py-3 flex items-start gap-3 border border-white/5 backdrop-blur-sm mt-16">
           <span className="text-[11px] font-bold text-[#00ff88] mt-0.5 shrink-0 bg-[#00ff88]/10 px-1.5 py-0.5 rounded">TIP</span>
           <p key={currentTip} className="text-[14px] text-gray-300 leading-snug animate-fadeIn break-keep">
             {TIPS[currentTip].replace("TIP: ", "")}
           </p>
        </div>

        {/* 4. Cancel (Control) */}
        <div className="w-full flex justify-center pt-2">
          <button
            onClick={handleCancel}
            disabled={isCanceling}
            className={`
              relative group px-8 py-3 rounded-full transition-all duration-300
              ${isCanceling ? 'bg-red-500/10 text-red-400 cursor-not-allowed' : 'hover:bg-white/5 text-gray-500 hover:text-gray-300 cursor-pointer'}
            `}
            aria-label="매칭 그만두기"
          >
            <span className="text-[15px] font-medium flex items-center gap-2">
               {isCanceling ? (
                 <>
                   <span className="animate-spin text-xs">⏳</span>
                   <span>그만두는 중...</span>
                 </>
               ) : (
                 "매칭 그만두기"
               )}
            </span>
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out forwards;
        }
        @keyframes equalizer {
          0%, 100% { height: 10px; opacity: 0.5; }
          50% { height: 50px; opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default MatchLoad;