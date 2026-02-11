import { Link, useLocation, useNavigate } from "react-router-dom"
import wootjimaLogo from "../assets/brand/wootjima-logo.png.png"
import { useModalRouter } from "../hooks/useModalRouter"
import { userStore } from "../stores/userStore"
import { useEffect, useRef, useState } from "react"
import { api } from "../lib/axios"

function Navigation() {
    const navigate = useNavigate()
    const location = useLocation()
    const { openModal } = useModalRouter()
    const { nickname, profileImage, accessToken, logout } = userStore()
    const [showProfileMenu, setShowProfileMenu] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowProfileMenu(false)
            }
        }

        if (showProfileMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showProfileMenu])

    const handleProfileEdit = () => {
        setShowProfileMenu(false)
        openModal('profile-page')
    }

    const handleLogout = async () => {
        setShowProfileMenu(false)
        try {
            await api.post('/auth/logout')
        } catch (error) {
            console.error('로그아웃 API 실패:', error)
        }
        logout()
        navigate('/')
    }

    return (
        <nav className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gray-800">
            <div className="w-full px-[clamp(16px,3vw,48px)]">
                <div className="flex h-[60px] md:h-[72px] items-center justify-between">
                    <div className="flex items-center gap-4 md:gap-8">
                        <div className="flex items-center gap-2 md:gap-3">
                            <img
                                src={wootjimaLogo}
                                alt="웃지마 로고"
                                className="w-9 h-9 md:w-11 md:h-11 rounded-xl object-cover"
                            />
                            <span
                                className="text-[#00FF88] text-[20px] md:text-[28px] font-bold"
                                style={{ fontFamily: 'SBAggroB, sans-serif', letterSpacing: '-0.2em' }}
                            >
                                ㅇㅈㅁ
                            </span>
                        </div>

                        <div className="flex gap-4 md:gap-10">
                            <Link
                                to='/'
                                className={`relative text-[15px] md:text-[17px] font-semibold transition-colors ${location.pathname === '/'
                                    ? 'text-white'
                                    : 'text-gray-500 hover:text-white'
                                    }`}
                            >
                                Random
                                {location.pathname === '/' && (
                                    <span className="absolute -bottom-1 left-0 w-full h-[3px] bg-white rounded-full" />
                                )}
                            </Link>
                            <Link
                                to='/room'
                                className={`relative text-[15px] md:text-[17px] font-semibold transition-colors ${location.pathname === '/room'
                                    ? 'text-white'
                                    : 'text-gray-500 hover:text-white'
                                    }`}
                            >
                                Room
                                {location.pathname === '/room' && (
                                    <span className="absolute -bottom-1 left-0 w-full h-[3px] bg-white rounded-full" />
                                )}
                            </Link>
                        </div>
                    </div>

                    {accessToken ? (
                        <div className="relative" ref={menuRef}>
                            <button
                                className="w-9 h-9 md:w-11 md:h-11 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors overflow-hidden ring-2 ring-gray-600 hover:ring-gray-500"
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                            >
                                {profileImage ? (
                                    <img src={profileImage} alt="프로필" className="w-full h-full object-cover" />
                                ) : (
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>

                            {showProfileMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-black border border-white rounded-xl shadow-lg overflow-hidden z-50">
                                    <div className="flex justify-center pt-5 pb-3">
                                        <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                                            {profileImage ? (
                                                <img src={profileImage} alt="프로필" className="w-full h-full object-cover" />
                                            ) : (
                                                <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-center pb-4">
                                        <p className="text-white text-sm font-medium">{nickname}</p>
                                    </div>

                                    <div className="border-t border-white"></div>

                                    <div className="py-2">
                                        <button
                                            onClick={handleProfileEdit}
                                            className="w-full px-4 py-2.5 text-center text-white text-sm hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            프로필 설정
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full px-4 py-2.5 text-center text-white text-sm hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            로그아웃
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => openModal('login')}
                            className="px-4 py-2 md:px-6 md:py-2.5 bg-white text-black rounded-full text-[13px] md:text-[15px] font-semibold hover:bg-gray-100 transition-colors"
                        >
                            로그인
                        </button>
                    )}
                </div>
            </div>
        </nav>
    )
}

export default Navigation
