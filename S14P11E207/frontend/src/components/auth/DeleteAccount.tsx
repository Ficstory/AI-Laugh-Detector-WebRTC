// components/DeleteAccountModal.tsx
import { useState } from 'react'
import axios from 'axios'
import { api } from '../../lib/axios'
import { useModalRouter } from '../../hooks/useModalRouter'
import { userStore } from '../../stores/userStore'
import { useNavigate } from 'react-router-dom'

function DeleteAccount() {
  const { openModal, closeModal } = useModalRouter()
  const { logout } = userStore()
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleCancel = () => {
    closeModal()
    openModal('profile-page')
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)

    try {
      await api.delete('/auth/delete')

      // 로그아웃 처리
      logout()

      // 모달 닫기
      closeModal()

      // 홈으로 이동
      navigate('/')

      alert('회원탈퇴가 완료되었습니다.')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        if (status === 401) {
          alert('인증이 만료되었습니다. 다시 로그인해주세요.')
        } else if (status === 404) {
          alert('회원 정보를 찾을 수 없습니다.')
        } else {
          alert('회원탈퇴에 실패했습니다. 다시 시도해주세요.')
        }
      } else {
        alert('회원탈퇴에 실패했습니다.')
      }
      console.error('회원탈퇴 실패:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="relative bg-[#2b2b2b] w-[90vw] max-w-md rounded-3xl flex flex-col p-8">
        
        <button
          className="absolute top-6 right-6 text-white text-2xl hover:text-gray-300 transition-colors"
          onClick={handleCancel}
        >
          ✕
        </button>

        {/* 메시지 */}
        <div className="pt-12 pb-8">
          <h2 className="text-2xl font-bold text-white text-center mb-4">
            정말 탈퇴하시겠습니까?
          </h2>
        </div>

        {/* 버튼들 */}
        <div className="space-y-3">
          <button
            onClick={handleCancel}
            disabled={isDeleting}
            className="w-full py-3 bg-white text-black rounded-full font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
          
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="w-full py-3 bg-[#ff6b6b] text-white rounded-full font-medium hover:bg-[#ff5555] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? '처리 중...' : '탈퇴하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteAccount