// components/SignupNicknameModal.tsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import { api } from '../../lib/axios'
import { signupStore } from '../../stores/signupStore'
import { useModalRouter } from '../../hooks/useModalRouter'

function SignupNicknameModal() {
  const { nickname, setNickname, completeNickname, reset } = signupStore()
  const { openModal, closeModal } = useModalRouter()
  
  const maxLength = 10
  const [isChecking, setIsChecking] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isValid = nickname.trim().length >= 2 && nickname.length <= maxLength

  const handleNicknameChange = (value: string) => {
    const regex = /^[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]*$/
    
    if (!regex.test(value)) {
      setErrorMessage('닉네임은 한글, 영어, 숫자만 사용가능합니다.')
      return
    }
    
    setNickname(value)
    setErrorMessage(null)
  }

  // 글자 수 초과 시 자동으로 에러 메시지 표시
  useEffect(() => {
    if (nickname.length > maxLength) {
      setErrorMessage('닉네임은 최대 10자 입니다.')
    } else if (nickname.length > 0 && errorMessage === '닉네임은 최대 10자 입니다.') {
      setErrorMessage(null)
    }
  }, [nickname.length, maxLength])

  const handleClose = () => {
    // 회원가입 상태 초기화
    reset()
    sessionStorage.removeItem('registerToken')
    closeModal()
  }

  const handleSubmit = async () => {
    if (!isValid) return

    setIsChecking(true)
    try {
      // 닉네임 중복 확인 API 호출
      await api.get('/user/check/nickname', {
        params: { nickname }
      })

      // 200 응답 → 사용 가능한 닉네임, 다음 모달로 이동
      completeNickname()
      openModal('signup-profile')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        if (status === 409) {
          setErrorMessage('이미 사용 중인 닉네임입니다.')
        } else if (status === 400) {
          setErrorMessage('유효하지 않은 닉네임 형식입니다.')
        } else {
          setErrorMessage('중복 검사에 실패했습니다.')
        }
      } else {
        setErrorMessage('중복 검사에 실패했습니다.')
      }
    } finally {
      setIsChecking(false)
    }
  }

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
            만나서 반가워요!
          </h2>
          <h2 className="text-2xl font-bold text-white mb-4">
            어떻게 불러드리면 될까요?
          </h2>
          
          {errorMessage && (
            <p className="text-sm text-[#ff6b6b]">
              {errorMessage}
            </p>
          )}
        </div>

        {/* 중앙 - 입력폼 */}
        <div className="flex-1 flex items-center">
          <div className="relative w-full">
            <input
              type="text"
              value={nickname}
              onChange={(e) => handleNicknameChange(e.target.value)}
              placeholder="닉네임을 입력해주세요."
              className={`
                w-full 
                bg-transparent 
                border-0 
                border-b-2 
                ${nickname.length > maxLength || errorMessage 
                  ? 'border-[#ff6b6b]' 
                  : 'border-gray-600'}
                pb-2
                text-lg
                outline-none
                ${nickname.length > maxLength || errorMessage 
                  ? 'focus:border-[#ff6b6b]' 
                  : 'focus:border-[#00ff88]'}
                
                transition-colors
                placeholder:text-gray-500
                text-white
              `}
            />
            <span className={`absolute right-0 bottom-2 text-sm ${
              nickname.length > maxLength ? 'text-[#ff6b6b]' : 'text-gray-500'
            }`}>
              {nickname.length} / {maxLength}
            </span>
          </div>
        </div>

        {/* 하단 - 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isChecking}
          className={`
            w-full
            py-3
            rounded-full
            font-medium
            transition-all
            ${isValid && !isChecking
              ? 'bg-[#00d9a3] text-white hover:bg-[#00c090]' 
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isChecking ? '확인 중...' : '다음'}
        </button>
      </div>
    </div>
  )
}

export default SignupNicknameModal