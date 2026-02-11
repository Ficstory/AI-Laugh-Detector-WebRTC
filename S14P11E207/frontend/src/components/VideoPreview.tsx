import { useEffect, useRef, useState } from "react"
import { mediaDeviceStore } from "../stores/mediaDeviceStore"
import { userStore } from "../stores/userStore"
import { useModalRouter } from "../hooks/useModalRouter"
import MicVisualizerOverlay from "./MicVisualizerOverlay"

interface VideoPreviewProps {
    className?: string
    showControls?: boolean
}

function VideoPreview({
    className = 'w-[46vw] aspect-[4/3]',
    showControls = true
}: VideoPreviewProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null)

    const [showCameraList, setShowCameraList] = useState(false)
    const [showMicList, setShowMicList] = useState(false)
    const [showMicVisualizer, setShowMicVisualizer] = useState(false)
    const [previewMicId, setPreviewMicId] = useState<string | null>(null)

    const {
        cameras,
        cameraStream,
        currentCameraId,
        cameraError,
        loadCameras,
        startCamera,
        mics,
        currentMicId,
        micError,
        loadMics,
        startMic,
        stopMic,
        setMicId,
        micStream,
        initializeFromStorage,
    } = mediaDeviceStore()

    const { accessToken } = userStore()
    const { openModal } = useModalRouter()

    // 컴포넌트 마운트 시 저장된 장치로 자동 연결
    useEffect(() => {
        initializeFromStorage()
    }, [])

    useEffect(() => {
        if (videoRef.current && cameraStream) {
            videoRef.current.srcObject = cameraStream
        }
    }, [cameraStream])

    const handleMicPreview = (deviceId: string) => {
        setPreviewMicId(deviceId)
        setShowMicList(false)
        startMic(deviceId)
        setShowMicVisualizer(true)
    }

    const handleMicConfirm = () => {
        if (previewMicId) {
            setMicId(previewMicId)
        }
        setPreviewMicId(null)
        setShowMicVisualizer(false)
    }

    const handleMicCancel = () => {
        stopMic()
        setPreviewMicId(null)
        setShowMicVisualizer(false)
    }

    return (
        <div className={`relative bg-[#3a3a3a] rounded-lg flex items-center justify-center ${className}`}>
            {cameraStream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover rounded-lg scale-x-[-1]"
                />
            ) : (
                <div className="flex flex-col items-center justify-center text-gray-500">
                    <svg className="w-16 h-16 mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18" />
                    </svg>
                    <p
                        key={`${!currentCameraId}-${!currentMicId}`}
                        className="text-sm transition-opacity duration-300 animate-fadeIn"
                    >
                        {!currentCameraId && !currentMicId && '카메라 및 마이크가 연결되지 않았습니다'}
                        {!currentCameraId && currentMicId && '카메라가 연결되지 않았습니다'}
                        {currentCameraId && !currentMicId && '마이크가 연결되지 않았습니다'}
                    </p>
                    <p className="text-xs mt-1 text-gray-600">테스트를 진행해주세요</p>
                </div>
            )}

            {showMicVisualizer && (
                <MicVisualizerOverlay
                    micStream={micStream}
                    onConfirm={handleMicConfirm}
                    onCancel={handleMicCancel}
                />
            )}

            {showControls && (
                <div className="absolute bottom-3 left-3 text-amber-50 flex flex-row gap-2">
                    <button
                        className={`flex items-center justify-center rounded-full px-[clamp(16px,2.3vw,32px)] py-[clamp(6px,1vw,16px)] text-[clamp(14px,1.4vw,20px)] transition-all duration-300 ${cameraStream ? 'bg-[#00FF88] text-black' : 'bg-gray-600 text-gray-300'}`}
                        onClick={() => {
                            if (!accessToken) {
                                openModal('login')
                                return
                            }
                            setShowCameraList(!showCameraList)
                            setShowMicList(false)
                            loadCameras()
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-[1.2em] h-[1.2em] mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                        </svg>
                        카메라 테스트
                    </button>
                    <button
                        className={`flex items-center justify-center rounded-full px-[clamp(16px,2.3vw,32px)] py-[clamp(6px,1vw,16px)] text-[clamp(14px,1.4vw,20px)] transition-all duration-300 ${micStream ? 'bg-[#00FF88] text-black' : 'bg-gray-600 text-gray-300'}`}
                        onClick={() => {
                            if (!accessToken) {
                                openModal('login')
                                return
                            }
                            setShowCameraList(false)
                            setShowMicList(!showMicList)
                            loadMics()
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-[1.2em] h-[1.2em] mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                        </svg>
                        마이크 테스트
                    </button>
                </div>
            )}

            {showCameraList && (
                <div className='absolute bottom-12 left-3 bg-black/80 text-white rounded p-2 w-60'>
                    {cameraError && <p className="text-xs text-red-300">{cameraError}</p>}
                    {!cameraError && cameras.length === 0 && <p>카메라 없음</p>}
                    {cameras.map((camera, index) => (
                        <button
                            key={camera.deviceId}
                            className='block bg-gray-200 text-black px-2 py-1 rounded mb-1 w-full text-left hover:bg-gray-300'
                            onClick={() => {
                                startCamera(camera.deviceId)
                                setShowCameraList(false)
                            }}
                        >
                            {camera.label || `카메라 ${index + 1}`}
                        </button>
                    ))}
                </div>
            )}

            {showMicList && (
                <div className='absolute bottom-12 left-3 bg-black/80 text-white rounded p-2 w-60'>
                    {micError && <p className="text-xs text-red-300">{micError}</p>}
                    {!micError && mics.length === 0 && <p>마이크 없음</p>}
                    {mics.map((mic, index) => (
                        <button
                            key={mic.deviceId}
                            className='block bg-gray-200 text-black px-2 py-1 rounded mb-1 w-full text-left hover:bg-gray-300'
                            onClick={() => handleMicPreview(mic.deviceId)}
                        >
                            {mic.label || `마이크 ${index + 1}`}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default VideoPreview
