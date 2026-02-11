import { useState, useEffect } from 'react';

interface BannerSlide {
    id: number;
    bgColor: string;
    accentColor: string;
    title: string;
    subtitle: string;
    buttonText?: string;
    buttonLink?: string;
    emojis: { emoji: string; size: string; top: string; right: string; delay: string }[];
}

// 토스 디자인 철학: 단순함, 캐주얼한 톤, 명확한 행동
const bannerSlides: BannerSlide[] = [
    {
        id: 1,
        bgColor: '#1a1a2e',
        accentColor: '#4F46E5',
        title: '녹화 걱정? 이제 안녕 👋',
        subtitle: '데스크톱 앱에서는 화면 녹화가 차단돼요',
        buttonText: '앱 다운로드',
        buttonLink: '/download',
        emojis: [
            { emoji: '🔒', size: 'text-3xl', top: '15%', right: '8%', delay: '0s' },
            { emoji: '🛡️', size: 'text-2xl', top: '55%', right: '18%', delay: '0.5s' },
            { emoji: '💻', size: 'text-xl', top: '35%', right: '3%', delay: '1s' },
        ],
    },
    {
        id: 2,
        bgColor: '#0f172a',
        accentColor: '#10B981',
        title: '웃긴 사람이 이긴다? 🤔',
        subtitle: '진짜 승률 높은 사람들은 자연스럽게 웃어요',
        emojis: [
            { emoji: '😊', size: 'text-3xl', top: '20%', right: '10%', delay: '0s' },
            { emoji: '✨', size: 'text-2xl', top: '50%', right: '5%', delay: '0.7s' },
            { emoji: '🎯', size: 'text-xl', top: '65%', right: '20%', delay: '0.3s' },
        ],
    },
];

function BannerCarousel() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // 자동 슬라이드 (6초마다)
    useEffect(() => {
        const timer = setInterval(() => {
            handleSlideChange((currentSlide + 1) % bannerSlides.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [currentSlide]);

    const handleSlideChange = (index: number) => {
        if (isTransitioning || index === currentSlide) return;
        setIsTransitioning(true);
        setCurrentSlide(index);
        setTimeout(() => setIsTransitioning(false), 500);
    };

    const slide = bannerSlides[currentSlide];

    return (
        <div className="relative overflow-hidden rounded-2xl" style={{ backgroundColor: slide.bgColor }}>
            {/* 배경 그라데이션 오브 */}
            <div
                className="absolute -right-20 -top-20 w-64 h-64 rounded-full opacity-15 blur-3xl transition-all duration-700"
                style={{ backgroundColor: slide.accentColor }}
            />

            {/* 둥둥 떠다니는 이모지들 */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {slide.emojis.map((item, idx) => (
                    <span
                        key={`${slide.id}-${idx}`}
                        className={`absolute ${item.size} opacity-40 animate-float`}
                        style={{
                            top: item.top,
                            right: item.right,
                            animationDelay: item.delay,
                        }}
                    >
                        {item.emoji}
                    </span>
                ))}
            </div>

            {/* 컨텐츠 */}
            <div className="relative z-10 px-7 py-8 h-[180px] flex flex-col justify-center">
                <div key={slide.id} className="animate-fadeIn">
                    <h3 className="text-white text-xl font-bold mb-2 tracking-tight leading-tight">
                        {slide.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        {slide.subtitle}
                    </p>
                </div>

                {/* 버튼 */}
                {slide.buttonText && slide.buttonLink && (
                    <a
                        href={slide.buttonLink}
                        className="mt-5 inline-flex items-center gap-2 text-white text-sm font-medium group w-fit"
                    >
                        <span
                            className="px-5 py-2.5 rounded-xl transition-all duration-200 group-hover:brightness-110"
                            style={{ backgroundColor: slide.accentColor }}
                        >
                            {slide.buttonText}
                        </span>
                    </a>
                )}
            </div>

            {/* 다음 배너 버튼 - 우측, 은은하게 */}
            <button
                onClick={() => handleSlideChange((currentSlide + 1) % bannerSlides.length)}
                className="absolute z-20 right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 group"
            >
                <svg
                    className="w-4 h-4 text-white/60 group-hover:text-white transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* 인디케이터 */}
            <div className="absolute z-20 bottom-4 left-6 flex gap-2">
                {bannerSlides.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => handleSlideChange(index)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide
                            ? 'w-6 bg-white'
                            : 'w-1.5 bg-white/30 hover:bg-white/50'
                            }`}
                    />
                ))}
            </div>

            {/* CSS 애니메이션 */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes float {
                    0%, 100% { 
                        transform: translateY(0px) rotate(0deg); 
                    }
                    50% { 
                        transform: translateY(-12px) rotate(5deg); 
                    }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.5s ease-out forwards;
                }
                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

export default BannerCarousel;
