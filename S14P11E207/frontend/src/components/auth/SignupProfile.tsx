// components/SignupProfileModal.tsx
import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { api } from '../../lib/axios'
import { signupStore } from '../../stores/signupStore'
import { useModalRouter } from '../../hooks/useModalRouter'

function SignupProfile() {
    const {
        nickname,
        isNicknameComplete,
        profileImage,
        profileImageObjectKey,
        setProfileImage,
        setProfileImageObjectKey,
        completeProfile,
        reset
    } = signupStore()
    const { openModal, closeModal } = useModalRouter()
    const [preview, setPreview] = useState<string | null>(null)
    const [fileError, setFileError] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const isClosingRef = useRef(false)

    // 권한 검증
    useEffect(() => {
        if (isClosingRef.current) return
        if (!isNicknameComplete) {
            openModal('signup-nickname')
        }
    }, [isNicknameComplete, openModal])

    // 미리보기 복원
    useEffect(() => {
        if (profileImage && !preview) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setPreview(reader.result as string)
            }
            reader.readAsDataURL(profileImage)
        }
    }, [profileImage, preview])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

            if (!allowedTypes.includes(file.type)) {
                setFileError(true)
                e.target.value = ''
                return
            }

            setFileError(false)
            setProfileImage(file)

            const reader = new FileReader()
            reader.onloadend = () => {
                setPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleNext = async () => {
        if (!profileImage) return

        setIsUploading(true)
        setUploadError(null)

        const registerToken = sessionStorage.getItem('registerToken')
        if (!registerToken) {
            setUploadError('회원가입 정보가 만료되었습니다.')
            setIsUploading(false)
            return
        }

        try {
            // 1. presigned URL 요청
            console.log(1)
            const response = await api.post('/user/upload/profileImage', {
                contentType: profileImage.type,
                fileSize: profileImage.size,
                originalFileName: profileImage.name,
                registerToken
            })

            console.log(response)

            const { uploadUrl, objectKey } = response.data.data

            // 2. MinIO에 이미지 업로드
            await axios.put(uploadUrl, profileImage, {
                headers: {
                    'Content-Type': profileImage.type
                }
            })

            // 3. objectKey 저장 (confirm은 회원가입 시 수행)
            setProfileImageObjectKey(objectKey)

            completeProfile()
            openModal('signup-terms')
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const status = error.response?.status
                if (status === 401) {
                    setUploadError('인증이 만료되었습니다. 다시 로그인해주세요.')
                } else if (status === 400) {
                    setUploadError('잘못된 요청입니다.')
                } else {
                    setUploadError('이미지 업로드에 실패했습니다.')
                }
            } else {
                setUploadError('이미지 업로드에 실패했습니다.')
            }
            console.error('이미지 업로드 실패:', error)
        } finally {
            setIsUploading(false)
        }
    }

    // MinIO에 업로드된 이미지 삭제
    const deleteUploadedImage = async () => {
        if (!profileImageObjectKey) return

        const registerToken = sessionStorage.getItem('registerToken')
        if (!registerToken) return

        try {
            await api.post('/user/delete/profileImage', {
                objectKey: profileImageObjectKey,
                registerToken
            })
            console.log('업로드된 이미지 삭제 완료')
        } catch (error) {
            console.error('이미지 삭제 실패:', error)
        }
    }

    const handleSkip = async () => {
        // MinIO에 업로드된 이미지가 있으면 삭제
        await deleteUploadedImage()

        setProfileImage(null)
        setProfileImageObjectKey(null)
        setPreview(null)
        completeProfile()
        openModal('signup-terms')
    }

    const handleClose = async () => {
        isClosingRef.current = true

        // MinIO에 업로드된 이미지가 있으면 삭제
        await deleteUploadedImage()

        // 회원가입 상태 초기화
        reset()
        sessionStorage.removeItem('registerToken')
        closeModal()
    }

    if (!isNicknameComplete) return null

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="relative bg-[#2b2b2b] w-[90vw] max-w-96 h-[600px] rounded-3xl flex flex-col p-8">

                <button
                    className="absolute top-6 right-6 text-white text-2xl"
                    onClick={handleClose}
                >
                    ✕
                </button>

                {/* 상단 - 안내문구 */}
                <div className="pt-12">
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {nickname}님의 프로필 이미지를
                    </h2>
                    <h2 className="text-2xl font-bold text-white mb-4">
                        등록해주세요.
                    </h2>
                    <p className="text-sm text-gray-400 mb-2">
                        상대를 웃길 수 있는 프로필 사진을 등록하면 더 좋아요!
                    </p>
                    
                    {/* 에러 메시지 고정 높이 */}
                    <div className="h-5">
                        {fileError && (
                            <p className="text-sm text-[#ff6b6b]">
                                jpg, jpeg, png, webp 형식만 사용 가능합니다.
                            </p>
                        )}
                        {uploadError && (
                            <p className="text-sm text-[#ff6b6b]">
                                {uploadError}
                            </p>
                        )}
                    </div>
                </div>

                {/* 중앙 - 이미지 */}
                <div className="flex-1 flex items-center justify-center">
                    <label className="relative cursor-pointer">
                        <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                            {preview ? (
                                <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <svg className="w-16 h-16 text-[#00ff88]" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                        
                        {/* 편집 아이콘 */}
                        <div className="absolute bottom-0 right-0 w-10 h-10 bg-[#00ff88] rounded-full flex items-center justify-center border-4 border-[#2b2b2b]">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </div>
                        
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </label>
                </div>

                {/* 하단 - 버튼 (고정 높이) */}
                <div className="h-[100px] flex flex-col justify-end gap-2">
                    {profileImage ? (
                        <>
                            <button
                                onClick={handleSkip}
                                disabled={isUploading}
                                className={`
                                    w-full
                                    py-3
                                    rounded-full
                                    font-medium
                                    transition-colors
                                    ${isUploading
                                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                        : 'bg-gray-600 text-white hover:bg-gray-500'
                                    }
                                `}
                            >
                                건너뛰기
                            </button>
                            <button
                                onClick={handleNext}
                                disabled={isUploading}
                                className={`
                                    w-full
                                    py-3
                                    rounded-full
                                    font-medium
                                    transition-colors
                                    ${isUploading
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-[#00d9a3] text-white hover:bg-[#00c090]'
                                    }
                                `}
                            >
                                {isUploading ? '업로드 중...' : '다음'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleSkip}
                            className="
                                w-full
                                py-3
                                rounded-full
                                font-medium
                                bg-gray-600
                                text-white
                                hover:bg-gray-500
                                transition-colors
                            "
                        >
                            건너뛰기
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default SignupProfile