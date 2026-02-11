import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { mediaDeviceStore } from '../stores/mediaDeviceStore'
import { userStore } from '../stores/userStore'
import { useModalRouter } from '../hooks/useModalRouter'
import BannerCarousel from '../components/BannerCarousel'

interface LocationState {
    reportSubmitted?: boolean;
    wasReported?: boolean;
}

function Random() {
    const navigate = useNavigate()
    const location = useLocation()
    const locationState = location.state as LocationState | null
    const [showReportNoticeModal, setShowReportNoticeModal] = useState(false)
    const [reportNoticeMessage, setReportNoticeMessage] = useState('')

    const {
        currentCameraId,
        currentMicId,
    } = mediaDeviceStore()

    const {
        accessToken,
        totalGames,
        totalWins,
        totalDraws,
        totalLosses,
        maxWinStreak,
        currentWinStreak,
        recentResults,
        fetchUserData,
    } = userStore()

    const { openModal } = useModalRouter()

    // 신고 관련 state 처리
    useEffect(() => {
        if (locationState?.reportSubmitted) {
            setReportNoticeMessage('신고가 정상적으로 접수되었습니다.')
            setShowReportNoticeModal(true)
            // state 초기화 (뒤로가기 시 다시 표시되지 않도록)
            navigate(location.pathname, { replace: true, state: {} })
        } else if (locationState?.wasReported) {
            setReportNoticeMessage('상대방에 의해 신고되었습니다.')
            setShowReportNoticeModal(true)
            navigate(location.pathname, { replace: true, state: {} })
        }
    }, [locationState, navigate, location.pathname])

    useEffect(() => {
        if (accessToken) {
            fetchUserData().catch((err) => {
                console.error('유저 정보 조회 실패:', err)
            })
        }
    }, [accessToken, fetchUserData])

    const winningRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100 * 10) / 10 : 0

    const handleStartBattle = () => {
        navigate('/match-load')
    }

    return (
        <div className="w-full h-full flex flex-col">
            {accessToken !== null ? (
                <>
                    <div className="flex-1 space-y-3">
                        {/* 프로모션 배너 캐러셀 */}
                        <BannerCarousel />


                        <div className="bg-[#2b2b2b] rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🏆</span>
                                    <h2 className="text-white text-base font-bold">나의 전적</h2>
                                </div>
                                <span className="text-gray-400 text-xs">{totalGames}전</span>
                            </div>

                            <div className="mb-4">
                                <div className="flex items-end justify-between mb-1">
                                    <p className="text-gray-400 text-xs">승률</p>
                                    <p className="text-white text-3xl font-bold">{winningRate}%</p>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-1.5">
                                    <div
                                        className="bg-white rounded-full h-1.5"
                                        style={{ width: `${winningRate}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="flex justify-around">
                                <div className="text-center">
                                    <p className="text-white text-xl font-bold">{totalWins}</p>
                                    <p className="text-gray-400 text-xs">승</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-white text-xl font-bold">{totalDraws}</p>
                                    <p className="text-gray-400 text-xs">무</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-white text-xl font-bold">{totalLosses}</p>
                                    <p className="text-gray-400 text-xs">패</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#2b2b2b] rounded-2xl p-3">
                                <div className="flex items-center gap-1 mb-1">
                                    <span className="text-sm">🔥</span>
                                    <p className="text-gray-400 text-xs">최고 연승</p>
                                </div>
                                <p className="text-white text-2xl font-bold">{maxWinStreak}</p>
                            </div>
                            <div className="bg-[#2b2b2b] rounded-2xl p-3">
                                <div className="flex items-center gap-1 mb-1">
                                    <span className="text-sm">🔥</span>
                                    <p className="text-gray-400 text-xs">현재 연승</p>
                                </div>
                                <p className="text-white text-2xl font-bold">{currentWinStreak}</p>
                            </div>
                        </div>

                        <div className="border-t border-gray-600"></div>

                        <div className="rounded-2xl p-3">
                            <p className="text-white text-xs mb-2">최근 5경기</p>
                            {recentResults.length > 0 ? (
                                <div className="grid grid-cols-5 gap-2">
                                    {recentResults.slice(0, 5).map((res, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center justify-center py-3 rounded-lg text-sm font-bold ${res === 'W' ? 'bg-gray-700 text-white' :
                                                res === 'D' ? 'bg-gray-800 text-white' :
                                                    res === 'L' ? 'bg-gray-800 text-gray-500' : ''
                                                }`}
                                        >
                                            {res}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-gray-500 text-sm">
                                    최근 기록이 없습니다
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 버튼 - 하단에 고정, 큰 간격 */}
                    <div className="mt-auto pt-10">
                        <button
                            onClick={handleStartBattle}
                            disabled={!currentCameraId || !currentMicId}
                            className={`w-full py-4 md:py-[clamp(7.5px,1.2vw,18px)] rounded-full font-bold text-[clamp(12px,1.1vw,16px)] transition-all ${currentCameraId && currentMicId
                                ? 'bg-white text-black hover:bg-gray-100'
                                : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-70'
                                }`}
                        >
                            {currentCameraId && currentMicId ? (
                                <span className="flex items-center justify-center gap-2">
                                    ▶ 랜덤배틀 시작하기
                                </span>
                            ) : (
                                `${!currentCameraId && !currentMicId ? '카메라, 마이크 테스트가 필요합니다' :
                                    !currentCameraId ? '카메라 테스트가 필요합니다' :
                                        '마이크 테스트가 필요합니다'}`
                            )}
                        </button>
                    </div>
                </>
            ) : (
                // Right Panel: Toss-style "Value First" Design
                <div className="flex flex-col h-full bg-[#1a1a1a] rounded-3xl p-8 justify-between relative overflow-hidden shadow-2xl ring-1 ring-white/5">
                    
                    {/* 1. Header (Identity) */}
                    <div className="flex justify-between items-center animate-fadeIn relative z-10">
                        <span className="text-white/40 text-sm font-medium tracking-wide">랜덤 매칭</span>
                        <div className="bg-[#262626] px-3 py-1.5 rounded-full border border-white/5 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse"></div>
                            <span className="text-[#00ff88] text-[10px] font-bold tracking-wider">LIVE</span>
                        </div>
                    </div>

                    {/* 2. Hero (Challenge Copy) */}
                    <div className="flex flex-col gap-4 mt-8 animate-fadeIn relative z-10" style={{ animationDelay: '100ms' }}>
                        <h1 className="text-[2.5rem] leading-[1.2] text-white font-bold break-keep">
                            60초,<br />
                            그 안에 상대를 웃겨볼까요?
                        </h1>
                        <p className="text-gray-400 text-lg font-light leading-relaxed break-keep">
                            지금 접속 중인 사람과 바로 매칭돼요
                        </p>
                    </div>

                    {/* 3. Preview (Abstracted UI) */}
                    <div className="flex-1 flex items-center justify-center my-6 animate-fadeIn relative z-10" style={{ animationDelay: '200ms' }}>
                        <div className="relative w-full max-w-[240px] aspect-[3/4] bg-[#262626] rounded-2xl border border-white/5 flex flex-col p-1.5 shadow-xl rotate-1 hover:rotate-0 transition-transform duration-500 ease-out">
                            {/* Top Cam (You) */}
                            <div className="flex-1 bg-[#333] mb-1.5 rounded-xl flex items-center justify-center relative overflow-hidden">
                                <span className="text-4xl filter grayscale contrast-125 opacity-80">🤣</span>
                                <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                                <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] text-white font-medium">나</div>
                            </div>
                            {/* Bottom Cam (Opponent) */}
                            <div className="flex-1 bg-[#333] rounded-xl flex items-center justify-center border-2 border-dashed border-white/10 relative overflow-hidden group">
                                <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce animation-delay-75"></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce animation-delay-150"></div>
                                </div>
                                <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] text-white/50 font-medium">상대방</div>
                                {/* Searching scan line effect */}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent translate-y-[-100%] animate-[shimmer_2s_infinite]"></div>
                            </div>
                        </div>
                    </div>

                    {/* 4. CTA (Action) */}
                    <div className="flex flex-col gap-4 animate-fadeIn relative z-10" style={{ animationDelay: '300ms' }}>
                        <button
                            onClick={() => openModal('login')}
                            className="w-full h-14 bg-[#00ff88] hover:bg-[#00e67a] active:scale-[0.98] rounded-2xl flex items-center justify-center transition-all duration-200 shadow-[0_4px_20px_rgba(0,255,136,0.15)] hover:shadow-[0_4px_25px_rgba(0,255,136,0.3)]"
                        >
                            <span className="text-[#1a1a1a] text-[17px] font-bold tracking-tight">지금 시작하기</span>
                        </button>
                        <p className="text-center text-gray-500 text-[11px] font-medium tracking-wide">
                            카메라와 마이크 권한이 필요해요
                        </p>
                    </div>

                    {/* Background Texture (Subtle) */}
                    <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-gradient-to-br from-white/5 to-transparent rounded-full blur-[80px] pointer-events-none"></div>
                </div>
            )}

            {/* 신고 알림 모달 */}
            {showReportNoticeModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]">
                    <div className="bg-[#1a1a1a] p-8 rounded-3xl max-w-sm w-full mx-4 relative">
                        <button
                            onClick={() => setShowReportNoticeModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12"></path>
                            </svg>
                        </button>
                        <div className="text-center pt-4">
                            <div className="text-4xl mb-4">
                                {reportNoticeMessage.includes('접수') ? '✅' : '⚠️'}
                            </div>
                            <div className="text-xl font-bold text-white mb-2">
                                알림
                            </div>
                            <div className="text-gray-300">
                                {reportNoticeMessage}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Random
