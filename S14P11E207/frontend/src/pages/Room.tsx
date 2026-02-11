import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/axios'
import { mediaDeviceStore } from '../stores/mediaDeviceStore'
import { userStore } from '../stores/userStore'
import { useModalRouter } from '../hooks/useModalRouter'

interface JoinByCodeResponse {
    id: number;
    name: string;
    token: string;
    participants: {
        userId: string;
        nickname: string;
        ready: boolean;
        host: boolean;
        profileImageUrl?: string | null;
        electron?: boolean;
    }[];
}

function Room() {
    const {
        currentCameraId,
        currentMicId,
    } = mediaDeviceStore()

    const {
        accessToken,
        nickname,
    } = userStore()

    const { openModal } = useModalRouter()
    const navigate = useNavigate()
    const [isCreating, setIsCreating] = useState(false)

    // State for Join Room Logic
    const [isEnteringCode, setIsEnteringCode] = useState(false)
    const [roomCode, setRoomCode] = useState('')
    const [isJoining, setIsJoining] = useState(false)

    const handleCreateRoom = async () => {
        if (!currentCameraId || !currentMicId) return
        if (isCreating) return
        setIsCreating(true)
        try {
            const roomName = nickname ? `${nickname}의 방` : '친구 초대 방'
            const createRes = await api.post('/room/create', {
                name: roomName,
                password: '',
                isElectronNeeded: false,
            })
            const created = createRes.data.data as { id: number; name: string; token: string }

            const joinRes = await api.post('/room/join', {
                id: created.id,
                password: '',
            })
            const joined = joinRes.data.data as {
                id: number
                name: string
                token: string
                participants: { userId: string; nickname: string; ready: boolean; host: boolean; profileImageUrl?: string | null }[]
            }

            const codeRes = await api.get(`/room/${created.id}/code`)
            const code = codeRes.data.data.roomCode as string

            navigate(`/room/matching/${joined.id}`, {
                state: {
                    token: joined.token,
                    roomName: joined.name || created.name,
                    participants: joined.participants,
                    roomCode: code,
                },
            })
        } catch (error) {
            console.error('방 생성 실패:', error)
            alert('방을 만들 수 없습니다.')
        } finally {
            setIsCreating(false)
        }
    }

    const handleJoinByCode = async () => {
        if (!roomCode.trim()) return
        if (isJoining) return
        setIsJoining(true)
        try {
            const res = await api.post('/room/join-by-code', { roomCode })
            const payload = res.data?.data as JoinByCodeResponse | undefined

            if (!payload?.id || !payload?.token) {
                throw new Error('방 정보를 불러올 수 없습니다.')
            }

            navigate(`/room/matching/${payload.id}`, {
                state: {
                    token: payload.token,
                    roomName: payload.name,
                    participants: payload.participants,
                    roomCode,
                },
                replace: true,
            })
        } catch (error) {
            console.error('입장 실패:', error)
            alert('입장에 실패했습니다. 코드를 확인해주세요.')
        } finally {
            setIsJoining(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleJoinByCode()
        }
    }

    return (
        <div className="w-full h-full flex flex-col">
            {accessToken !== null ? (
                <div className="w-full h-full flex flex-col justify-start md:justify-center gap-3 md:gap-4 p-2 md:p-4">
                    {/* Create Room Section */}
                    <button
                        onClick={handleCreateRoom}
                        disabled={!currentCameraId || !currentMicId || isCreating}
                        className={`group relative w-full h-36 md:h-60 flex flex-col items-center justify-center rounded-2xl md:rounded-3xl transition-all duration-300 border border-white/5 overflow-hidden
                        ${currentCameraId && currentMicId
                                ? 'bg-[#2b2b2b] hover:bg-[#383838] hover:scale-[1.02] hover:border-white/20 cursor-pointer shadow-lg hover:shadow-xl'
                                : 'bg-[#1a1a1a] opacity-70 cursor-not-allowed'}`}
                    >
                        <div className={`text-3xl md:text-5xl mb-2 md:mb-4 transition-transform duration-300 ${currentCameraId && currentMicId ? 'group-hover:scale-110 group-hover:rotate-3' : 'grayscale'}`}>
                            🏠
                        </div>
                        <h2 className="text-white text-lg md:text-2xl font-bold mb-1">방 만들기</h2>
                        <p className="text-gray-400 text-xs md:text-sm font-medium">
                            {isCreating ? '생성 중...' : '새로운 게임 방 개설'}
                        </p>
                    </button>

                    {/* Enter Room Code Section */}
                    {!isEnteringCode ? (
                        <button
                            onClick={() => setIsEnteringCode(true)}
                            disabled={!currentCameraId || !currentMicId}
                            className={`group relative w-full h-36 md:h-60 flex flex-col items-center justify-center rounded-2xl md:rounded-3xl transition-all duration-300 border border-white/5 overflow-hidden
                            ${currentCameraId && currentMicId
                                    ? 'bg-[#2b2b2b] hover:bg-[#383838] hover:scale-[1.02] hover:border-white/20 cursor-pointer shadow-lg hover:shadow-xl'
                                    : 'bg-[#1a1a1a] opacity-70 cursor-not-allowed'}`}
                        >
                            <div className={`text-3xl md:text-5xl mb-2 md:mb-4 transition-transform duration-300 ${currentCameraId && currentMicId ? 'group-hover:scale-110 group-hover:-rotate-3' : 'grayscale'}`}>
                                ⌨️
                            </div>
                            <h2 className="text-white text-lg md:text-2xl font-bold mb-1">방 코드 입력하기</h2>
                            <p className="text-gray-400 text-xs md:text-sm font-medium">
                                공유받은 코드로 입장
                            </p>
                        </button>
                    ) : (
                        <div className="w-full h-auto min-h-[180px] md:min-h-[240px] flex flex-col items-center justify-center bg-[#2b2b2b] rounded-2xl md:rounded-3xl border border-white/5 p-4 md:p-6 animate-fadeIn overflow-hidden transition-all duration-300 shadow-xl">
                            <div className="w-full max-w-sm flex flex-col items-center space-y-3 md:space-y-5">
                                <span className="text-3xl md:text-4xl mb-1">🔑</span>
                                <h3 className="text-lg md:text-xl font-bold text-white">코드 입력</h3>

                                <input
                                    autoFocus
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                    onKeyDown={handleKeyDown}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 md:px-6 md:py-3 text-white text-center text-xl md:text-2xl font-bold tracking-[0.3em] md:tracking-[0.5em] placeholder:text-gray-600 outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all uppercase"
                                    placeholder="AB12CD"
                                    maxLength={6}
                                />

                                <div className="flex gap-2 md:gap-3 w-full pt-1">
                                    <button
                                        onClick={() => {
                                            setIsEnteringCode(false)
                                            setRoomCode('')
                                        }}
                                        className="flex-1 py-2 md:py-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300 font-bold transition-colors text-xs md:text-sm"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleJoinByCode}
                                        disabled={!roomCode || isJoining}
                                        className={`flex-1 py-2 md:py-2.5 rounded-lg font-bold transition-all text-xs md:text-sm
                                            ${roomCode && !isJoining
                                                ? 'bg-white text-black hover:bg-gray-100'
                                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                    >
                                        {isJoining ? '입장 중...' : '입장하기'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // Right Panel: Party & Friends Theme
                <div className="flex flex-col h-full bg-[#1a1a1a] rounded-3xl p-8 justify-between relative overflow-hidden shadow-2xl ring-1 ring-white/5">
                    
                    {/* 1. Header */}
                    <div className="flex justify-between items-center animate-fadeIn relative z-10">
                        <span className="text-white/40 text-sm font-medium tracking-wide">친구 초대</span>
                        <div className="bg-[#262626] px-3 py-1.5 rounded-full border border-white/5 flex items-center gap-1.5">
                            <span className="text-white/60 text-[10px] font-bold tracking-wider">최대 4명</span>
                        </div>
                    </div>

                    {/* 2. Hero Section */}
                    <div className="flex flex-col gap-4 mt-8 animate-fadeIn relative z-10" style={{ animationDelay: '100ms' }}>
                        <h1 className="text-[2.5rem] leading-[1.2] text-white font-bold break-keep">
                            친구들과 함께,<br />
                            더 재밌게
                        </h1>
                        <p className="text-gray-400 text-lg font-light leading-relaxed break-keep">
                            방을 만들고 코드를 공유해보세요
                        </p>
                    </div>

                    {/* 3. Multi-Player Preview */}
                    <div className="flex-1 flex items-center justify-center my-6 animate-fadeIn relative z-10" style={{ animationDelay: '200ms' }}>
                        <div className="relative w-full max-w-[280px]">
                            {/* Party Room Card */}
                            <div className="bg-[#262626] rounded-2xl border border-white/5 p-4 shadow-xl">
                                {/* Room Header */}
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl filter grayscale opacity-50">🏠</span>
                                        <span className="text-white text-sm font-bold">게임 룸</span>
                                    </div>
                                    <div className="bg-[#00ff88]/10 px-2 py-1 rounded-md">
                                        <span className="text-[#00ff88] text-[10px] font-mono font-bold">AB12CD</span>
                                    </div>
                                </div>

                                {/* Player Slots Grid (2x2) */}
                                <div className="grid grid-cols-2 gap-2">
                                    {/* Slot 1: Host (You) */}
                                    <div className="bg-[#333] rounded-xl p-3 flex flex-col items-center justify-center relative border border-white/5">
                                        <span className="text-2xl mb-1 filter grayscale contrast-125 opacity-80">😎</span>
                                        <span className="text-white text-[10px] font-medium">나</span>
                                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#00ff88] rounded-full"></div>
                                    </div>

                                    {/* Slot 2: Friend 1 */}
                                    <div className="bg-[#333] rounded-xl p-3 flex flex-col items-center justify-center relative border border-white/5">
                                        <span className="text-2xl mb-1 filter grayscale opacity-60">🤣</span>
                                        <span className="text-white/50 text-[10px] font-medium">친구 1</span>
                                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                    </div>

                                    {/* Slot 3: Empty */}
                                    <div className="bg-[#2a2a2a] rounded-xl p-3 flex flex-col items-center justify-center border-2 border-dashed border-white/10">
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-1">
                                            <span className="text-white/30 text-lg">+</span>
                                        </div>
                                        <span className="text-white/30 text-[9px] font-medium">대기 중</span>
                                    </div>

                                    {/* Slot 4: Empty */}
                                    <div className="bg-[#2a2a2a] rounded-xl p-3 flex flex-col items-center justify-center border-2 border-dashed border-white/10">
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-1">
                                            <span className="text-white/30 text-lg">+</span>
                                        </div>
                                        <span className="text-white/30 text-[9px] font-medium">대기 중</span>
                                    </div>
                                </div>

                                {/* Room Status */}
                                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-center gap-2">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-gray-500">👥</span>
                                        <span className="text-[10px] text-gray-400 font-medium">2/4</span>
                                    </div>
                                    <span className="text-white/20">•</span>
                                    <span className="text-[10px] text-gray-400 font-medium">준비 중</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. CTA */}
                    <div className="flex flex-col gap-4 animate-fadeIn relative z-10" style={{ animationDelay: '300ms' }}>
                        <button
                            onClick={() => openModal('login')}
                            className="w-full h-14 bg-[#00ff88] hover:bg-[#00e67a] active:scale-[0.98] rounded-2xl flex items-center justify-center transition-all duration-200 shadow-[0_4px_20px_rgba(0,255,136,0.15)] hover:shadow-[0_4px_25px_rgba(0,255,136,0.3)]"
                        >
                            <span className="text-[#1a1a1a] text-[17px] font-bold tracking-tight">방 만들기</span>
                        </button>
                        <p className="text-center text-gray-500 text-[11px] font-medium tracking-wide">
                            로그인하고 친구들을 초대해보세요
                        </p>
                    </div>

                    {/* Background Texture */}
                    <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-gradient-to-br from-white/5 to-transparent rounded-full blur-[80px] pointer-events-none"></div>
                </div>
            )}
        </div>
    )
}

export default Room
