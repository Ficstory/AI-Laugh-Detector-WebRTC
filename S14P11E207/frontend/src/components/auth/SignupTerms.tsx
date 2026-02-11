import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { api } from '../../lib/axios'
import { signupStore } from '../../stores/signupStore'
import { userStore } from '../../stores/userStore'
import { useModalRouter } from '../../hooks/useModalRouter'

function SignupTerms() {
    const {
        isNicknameComplete,
        isProfileComplete,
        nickname,
        profileImageObjectKey,
        reset
    } = signupStore()
    const { setLoginData } = userStore()
    const { openModal, closeModal } = useModalRouter()

    const [allAgreed, setAllAgreed] = useState(false)
    const [termsAgreed, setTermsAgreed] = useState(false)
    const [privacyAgreed, setPrivacyAgreed] = useState(false)
    const [marketingAgreed, setMarketingAgreed] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const allRequiredAgreed = termsAgreed && privacyAgreed
    const isClosingRef = useRef(false)

    // 권한 검증
    useEffect(() => {
        if (isClosingRef.current) return
        if (!isNicknameComplete) {
            openModal('signup-nickname')
        } else if (!isProfileComplete) {
            openModal('signup-profile')
        }
    }, [isNicknameComplete, isProfileComplete, openModal])

    // 전체 동의 처리
    const handleAllAgreed = (checked: boolean) => {
        setAllAgreed(checked)
        setTermsAgreed(checked)
        setPrivacyAgreed(checked)
        setMarketingAgreed(checked)
    }

    // 개별 체크박스 변경 시 전체 동의 상태 업데이트
    useEffect(() => {
        setAllAgreed(termsAgreed && privacyAgreed && marketingAgreed)
    }, [termsAgreed, privacyAgreed, marketingAgreed])

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

    const handleClose = async () => {
        isClosingRef.current = true

        // MinIO에 업로드된 이미지가 있으면 삭제
        await deleteUploadedImage()

        // 회원가입 상태 초기화
        reset()
        sessionStorage.removeItem('registerToken')
        closeModal()
    }

    const handleSubmit = async () => {
        if (!allRequiredAgreed) return

        setIsSubmitting(true)

        const registerToken = sessionStorage.getItem('registerToken')
        if (!registerToken) {
            alert('회원가입 정보가 만료되었습니다. 다시 로그인해주세요.')
            closeModal()
            return
        }

        try {
            let confirmedProfileImageUrl: string | null = null

            // 이미지가 있으면 먼저 confirm API 호출
            if (profileImageObjectKey) {
                try {
                    const confirmResponse = await api.post('/user/confirm/profileImage', {
                        objectKey: profileImageObjectKey,
                        registerToken
                    })
                    confirmedProfileImageUrl = confirmResponse.data.data.profileImageUrl
                    console.log('이미지 confirm 성공:', confirmedProfileImageUrl)
                } catch (error) {
                    console.error('이미지 confirm 실패:', error)
                    alert('이미지 저장에 실패했습니다. 다시 시도해주세요.')
                    setIsSubmitting(false)
                    return
                }
            }

            console.log('회원가입 요청 데이터:', {
                registerToken,
                nickname,
                profileImage: confirmedProfileImageUrl,
                isMarketing: marketingAgreed
            })

            const response = await api.post('/auth/regist', {
                registerToken,
                nickname,
                profileImage: confirmedProfileImageUrl,
                isMarketing: marketingAgreed
            })

            console.log('회원가입 응답:', response.data)

            // 응답 구조에 따라 데이터 추출
            const data = response.data.data || response.data
            const accessToken = data.accessToken
            const refreshToken = data.refreshToken
            const user = data.user

            // 로그인 데이터 저장 (회원가입 시에는 fetchUserData 호출하지 않음 - 마케팅 동의 값 덮어쓰기 방지)
            setLoginData({
                accessToken,
                refreshToken,
                nickname: user?.nickname || nickname,
                profileImageUrl: user?.profileImageUrl || '',
                isMarketing: marketingAgreed
            })

            // registerToken 제거
            sessionStorage.removeItem('registerToken')

            // 성공 모달 표시 후 store 초기화
            openModal('signup-success')
            setTimeout(() => {
                reset()
            }, 100)
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const status = error.response?.status
                if (status === 401) {
                    alert('인증이 만료되었습니다. 다시 로그인해주세요.')
                    sessionStorage.removeItem('registerToken')
                    closeModal()
                } else if (status === 400) {
                    alert('잘못된 요청입니다.')
                } else {
                    alert('회원가입에 실패했습니다. 다시 시도해주세요.')
                }
            } else {
                alert('회원가입에 실패했습니다.')
            }
            console.error('회원가입 실패:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isNicknameComplete || !isProfileComplete) return null

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
                <div className="pt-12 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">
                        웃지마 서비스 이용 약관에
                    </h2>
                    <h2 className="text-2xl font-bold text-white mb-4">
                        동의해주세요
                    </h2>
                    <p className="text-sm text-gray-400">
                        사용자의 개인정보 및 서비스 이용 권리
                    </p>
                    <p className="text-sm text-gray-400">
                        잘 지켜드릴게요.
                    </p>
                </div>

                {/* 중앙 - 약관 동의 */}
                <div className="flex-1 flex flex-col justify-center">
                    <div className="space-y-3 mb-6">
                        {/* 서비스 이용약관 */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center cursor-pointer flex-1">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={termsAgreed}
                                        onChange={(e) => setTermsAgreed(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                        termsAgreed ? 'bg-[#00d9a3]' : 'bg-transparent border-2 border-gray-600'
                                    }`}>
                                        {termsAgreed && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                                <span className="ml-3 text-sm text-white">
                                    <span className="text-[#ff6b6b]">(필수)</span> 서비스 이용약관 동의
                                </span>
                            </label>
                            <a
                                href="https://ryuwon-project.notion.site/2f7a58d49be6819ba2ddf1dc505e19c9?pvs=74"
                                target="_blank"
                                className="text-xs text-gray-400 hover:text-[#00d9a3] ml-2"
                            >
                                보기
                            </a>
                        </div>

                        {/* 개인정보 처리방침 */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center cursor-pointer flex-1">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={privacyAgreed}
                                        onChange={(e) => setPrivacyAgreed(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                        privacyAgreed ? 'bg-[#00d9a3]' : 'bg-transparent border-2 border-gray-600'
                                    }`}>
                                        {privacyAgreed && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                                <span className="ml-3 text-sm text-white">
                                    <span className="text-[#ff6b6b]">(필수)</span> 개인정보 처리방침 동의
                                </span>
                            </label>
                            <a
                                href="https://ryuwon-project.notion.site/2f7a58d49be681e38f88f2b9502ab0b6?pvs=74"
                                target="_blank"
                                className="text-xs text-gray-400 hover:text-[#00d9a3] ml-2"
                            >
                                보기
                            </a>
                        </div>

                        {/* 마케팅 정보 수신 */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center cursor-pointer flex-1">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={marketingAgreed}
                                        onChange={(e) => setMarketingAgreed(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                        marketingAgreed ? 'bg-[#00d9a3]' : 'bg-transparent border-2 border-gray-600'
                                    }`}>
                                        {marketingAgreed && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                                <span className="ml-3 text-sm text-white">
                                    <span className="text-gray-400">(선택)</span> 마케팅 정보 수신동의
                                </span>
                            </label>
                            <a
                                href="https://ryuwon-project.notion.site/2fea58d49be680d88fbfdb59a6ce4081?pvs=74"
                                target="_blank"
                                className="text-xs text-gray-400 hover:text-[#00d9a3] ml-2"
                            >
                                보기
                            </a>
                        </div>
                    </div>

                    {/* 구분선 */}
                    <div className="border-t border-gray-600 my-4"></div>

                    {/* 전체 약관동의 */}
                    <label className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={allAgreed}
                                onChange={(e) => handleAllAgreed(e.target.checked)}
                                className="sr-only"
                            />
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                allAgreed ? 'bg-[#00d9a3]' : 'bg-gray-600'
                            }`}>
                                {allAgreed && (
                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                        </div>
                        <span className="ml-3 text-base font-medium text-white">
                            전체 약관동의
                        </span>
                    </label>
                    <p className="text-xs text-gray-400 ml-9 mt-1">
                        서비스 이용을 위해 위 약관들을 모두 동의합니다.
                    </p>
                </div>

                {/* 하단 - 버튼 */}
                <button
                    onClick={handleSubmit}
                    disabled={!allRequiredAgreed || isSubmitting}
                    className={`
                        w-full
                        py-3
                        rounded-full
                        font-medium
                        transition-all
                        ${allRequiredAgreed && !isSubmitting
                            ? 'bg-[#00d9a3] text-white hover:bg-[#00c090]'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }
                    `}
                >
                    {isSubmitting ? '처리 중...' : '완료'}
                </button>
            </div>
        </div>
    )
}

export default SignupTerms