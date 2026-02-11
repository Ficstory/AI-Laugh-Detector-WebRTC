// components/SignupSuccessModal.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModalRouter } from '../../hooks/useModalRouter'
import { signupStore } from '../../stores/signupStore'
import { userStore } from '../../stores/userStore'

function SignupSuccess() {
  const { nickname } = userStore()
  const { closeModal } = useModalRouter()
  const { reset } = signupStore()
  const navigate = useNavigate()

  // 모달이 열릴 때 reset
  useEffect(() => {
    reset()
  }, [reset])

  const handleStart = () => {
    closeModal()
    const redirectPath = sessionStorage.getItem('postLoginRedirect')
    if (redirectPath) {
      sessionStorage.removeItem('postLoginRedirect')
      navigate(redirectPath)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="relative bg-[#2b2b2b] w-[90vw] max-w-96 h-[600px] rounded-3xl flex flex-col p-8">

        <button
          className="absolute top-6 right-6 text-white text-2xl"
          onClick={closeModal}
        >
          ✕
        </button>

        {/* 상단 - 환영 메시지 */}
        <div className="pt-6 mb-8 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold text-white">
            {nickname}님{nickname.length >= 6 ? <br /> : ' '}환영합니다!
          </h2>
        </div>

        {/* 중앙 - 게임 안내 */}
        <div className="flex-1 space-y-3">
          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl">🎮</span>
              <span className="text-white font-bold text-sm">게임 방법</span>
            </div>
            <p className="text-gray-400 text-xs pl-8">
              랜덤 상대와 매칭 후, 웃음을 참아야 승리!
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl">📹</span>
              <span className="text-white font-bold text-sm">시작 전 준비</span>
            </div>
            <p className="text-gray-400 text-xs pl-8">
              카메라/마이크 테스트 후 바로 배틀 시작!
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl">🏆</span>
              <span className="text-white font-bold text-sm">랭킹 도전</span>
            </div>
            <p className="text-gray-400 text-xs pl-8">
              연승을 쌓아 최고의 포커페이스에 도전!
            </p>
          </div>
        </div>

        {/* 하단 - 버튼 */}
        <button
          onClick={handleStart}
          className="
            w-full
            py-3
            rounded-full
            font-medium
            bg-[#00d9a3]
            text-white
            hover:bg-[#00c090]
            transition-colors
          "
        >
          시작하기
        </button>
      </div>
    </div>
  )
}

export default SignupSuccess
