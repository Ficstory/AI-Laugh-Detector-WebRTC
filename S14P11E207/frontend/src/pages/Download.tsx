import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';

interface FAQ {
    question: string;
    answer: string;
}

const faqs: FAQ[] = [
    {
        question: '왜 데스크톱 앱을 따로 만들었나요?',
        answer: '웹 브라우저에서는 화면 녹화를 막을 방법이 없어요. 데스크톱 앱은 시스템 레벨에서 화면 캡처를 차단해서, 배틀 중 내 표정이 녹화되는 걸 막아줘요.',
    },
    {
        question: '어떻게 녹화를 막는 건가요?',
        answer: '일렉트론(Electron) 기술로 만들어졌어요. 배틀 화면에 특수 보호막을 씌워서 OBS, 반디캠 같은 녹화 프로그램이 검은 화면만 캡처하도록 해요.',
    },
    {
        question: '웹 버전이랑 뭐가 다른가요?',
        answer: '기능은 100% 동일해요. 화면 보호 기능만 추가된 거라서, 웹에서 하던 것처럼 똑같이 사용하면 돼요.',
    },
    {
        question: '컴퓨터가 느려지지 않나요?',
        answer: '앱 용량은 약 100MB, 메모리는 크롬 탭 하나 정도만 써요. 대부분의 컴퓨터에서 문제없이 잘 돌아가요.',
    },
];

function Download() {
    const navigate = useNavigate();
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggleFaq = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    const handleDownload = () => {
        // Prod MinIO URL (dist.zip)
        window.location.href = 'https://i14e207.p.ssafy.io/objects/electron-builds/dist.zip';
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* 네비게이션 */}
            <Navigation />

            {/* 히어로 섹션 - 토스 스타일: 큰 여백, 명확한 메시지 */}
            <section className="relative px-6 pt-20 pb-24 md:pt-32 md:pb-36">
                {/* 배경 그라데이션 */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-indigo-600/20 via-transparent to-transparent rounded-full blur-3xl" />
                </div>

                <div className="relative z-10 max-w-2xl mx-auto text-center">
                    {/* 타이틀 - 토스 스타일: 짧고 임팩트 있게 */}
                    <h1 className="text-[clamp(32px,6vw,56px)] font-bold text-white mb-6 leading-[1.2] tracking-tight">
                        녹화 걱정 없이<br />
                        마음껏 웃으세요
                    </h1>

                    <p className="text-[clamp(16px,2vw,20px)] text-gray-400 mb-12 leading-relaxed">
                        데스크톱 앱은 화면 녹화를 차단해요
                    </p>

                    {/* 다운로드 버튼 - 토스 스타일: 크고 명확하게 */}
                    <button
                        onClick={handleDownload}
                        className="inline-flex items-center gap-3 bg-white hover:bg-gray-100 text-black font-semibold px-8 py-4 rounded-2xl text-lg transition-all duration-200"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Windows 다운로드
                    </button>

                    <p className="text-sm text-gray-500 mt-4">
                        macOS 버전은 곧 출시돼요
                    </p>
                </div>
            </section>

            {/* 기능 설명 - 토스 스타일: 심플한 3단 카드 */}
            <section className="px-6 py-16 md:py-24 border-t border-white/5">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-16">
                        웹과 똑같은데, 더 안전해요
                    </h2>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-6 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">
                                🛡️
                            </div>
                            <h3 className="text-white font-semibold mb-2">화면 녹화 차단</h3>
                            <p className="text-gray-500 text-sm">
                                배틀 중 녹화 프로그램은<br />검은 화면만 캡처해요
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-6 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">
                                ⚡
                            </div>
                            <h3 className="text-white font-semibold mb-2">가벼운 앱</h3>
                            <p className="text-gray-500 text-sm">
                                크롬 탭 하나 정도의<br />메모리만 사용해요
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-6 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">
                                🔄
                            </div>
                            <h3 className="text-white font-semibold mb-2">동일한 기능</h3>
                            <p className="text-gray-500 text-sm">
                                웹 버전과 100%<br />같은 기능이에요
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ 섹션 - 토스 스타일: 넉넉한 여백, 깔끔한 아코디언 */}
            <section className="px-6 py-16 md:py-24 border-t border-white/5">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
                        자주 묻는 질문
                    </h2>

                    <div className="space-y-3">
                        {faqs.map((faq, index) => (
                            <div
                                key={index}
                                className="bg-white/[0.03] hover:bg-white/[0.05] rounded-2xl overflow-hidden transition-colors"
                            >
                                <button
                                    onClick={() => toggleFaq(index)}
                                    className="w-full px-6 py-5 text-left flex items-center justify-between gap-4"
                                >
                                    <span className="text-white font-medium">{faq.question}</span>
                                    <svg
                                        className={`w-5 h-5 text-gray-500 transition-transform duration-200 flex-shrink-0 ${openIndex === index ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                <div
                                    className={`overflow-hidden transition-all duration-200 ${openIndex === index ? 'max-h-40 pb-5 px-6' : 'max-h-0'}`}
                                >
                                    <p className="text-gray-400 leading-relaxed">
                                        {faq.answer}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA 섹션 */}
            <section className="px-6 py-16 md:py-20 border-t border-white/5">
                <div className="max-w-xl mx-auto text-center">
                    <p className="text-gray-400 mb-6">
                        설치 없이 바로 시작하고 싶다면
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="text-white font-medium hover:text-gray-300 transition-colors underline underline-offset-4"
                    >
                        웹 버전으로 시작하기 →
                    </button>
                </div>
            </section>
        </div>
    );
}

export default Download;
