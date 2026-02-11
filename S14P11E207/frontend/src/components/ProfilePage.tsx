// components/ProfilePage.tsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import { api } from '../lib/axios'
import { userStore } from '../stores/userStore'
import { useModalRouter } from '../hooks/useModalRouter'

function ProfilePage() {
  const { closeModal, openModal } = useModalRouter()
  const { nickname: currentNickname, profileImage: currentProfileImage, isMarketing, fetchUserData, updateUserProfile } = userStore()

  // 모달 열릴 때 유저 정보 조회 (마케팅 동의 정보 등)
  useEffect(() => {
    fetchUserData().catch((err) => {
      console.error('유저 정보 조회 실패:', err)
    })
  }, [fetchUserData])

  const [profileImage, setProfileImage] = useState(currentProfileImage || '')
  const [nickname, setNickname] = useState(currentNickname || '')
  const [marketingConsent, setMarketingConsent] = useState(isMarketing || false)

  const maxLength = 10
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImageUploading, setIsImageUploading] = useState(false)
  const [nicknameError, setNicknameError] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageSuccess, setImageSuccess] = useState(false)

  const isValid = nickname.trim().length >= 2 && nickname.length <= maxLength
  const hasChanges =
    nickname !== currentNickname ||
    marketingConsent !== isMarketing

  const handleNicknameChange = (value: string) => {
    const regex = /^[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]*$/

    if (!regex.test(value)) {
      setNicknameError('닉네임은 한글, 영어, 숫자만 사용가능합니다.')
      return
    }

    setNickname(value)
    setNicknameError(null)
  }

  // userStore 값이 변경되면 로컬 상태 동기화
  useEffect(() => {
    setMarketingConsent(isMarketing)
  }, [isMarketing])

  useEffect(() => {
    if (currentNickname) {
      setNickname(currentNickname)
    }
  }, [currentNickname])

  useEffect(() => {
    if (currentProfileImage) {
      setProfileImage(currentProfileImage)
    }
  }, [currentProfileImage])

  useEffect(() => {
    if (nickname.length > maxLength) {
      setNicknameError('닉네임은 최대 10자 입니다.')
    } else if (nickname.length > 0 && nicknameError === '닉네임은 최대 10자 입니다.') {
      setNicknameError(null)
    }
  }, [nickname.length, maxLength, nicknameError])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setImageError('jpg, jpeg, png, webp 형식만 사용 가능합니다.')
      e.target.value = ''
      return
    }

    setImageError(null)
    setImageSuccess(false)
    setIsImageUploading(true)

    // 미리보기 설정
    const reader = new FileReader()
    reader.onloadend = () => {
      setProfileImage(reader.result as string)
    }
    reader.readAsDataURL(file)

    try {
      // 1. presigned URL 요청
      const uploadResponse = await api.post('/user/upload/profileImage', {
        contentType: file.type,
        fileSize: file.size,
        originalFileName: file.name
      })

      const { uploadUrl, objectKey } = uploadResponse.data.data

      // 2. MinIO에 이미지 업로드
      await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type
        }
      })

      // 3. 백엔드에 업로드 완료 확인 요청
      const confirmResponse = await api.post('/user/confirm/profileImage', {
        objectKey
      })

      // 4. userStore 업데이트
      const newProfileImageUrl = confirmResponse.data.data.profileImageUrl
      updateUserProfile({
        profileImageUrl: newProfileImageUrl
      })
      setProfileImage(newProfileImageUrl)
      setImageSuccess(true)
    } catch (error) {
      console.error('이미지 업로드 실패:', error)
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        console.error('에러 상태 코드:', status, '응답:', error.response?.data)
        if (status === 401) {
          alert('인증이 만료되었습니다. 다시 로그인해주세요.')
          closeModal()
          return
        }
      }
      setImageError('이미지 업로드에 실패했습니다.')
    } finally {
      setIsImageUploading(false)
      e.target.value = ''
    }
  }

  const handleMarketingConsentToggle = async () => {
    const newConsent = !marketingConsent
    setMarketingConsent(newConsent)

    // TODO: API 호출
    try {
      // await updateMarketingConsent(newConsent)
      console.log('마케팅 수신동의 변경:', newConsent)
    } catch (error) {
      console.error('마케팅 수신동의 변경 실패:', error)
      // 실패 시 원래 상태로 복구
      setMarketingConsent(!newConsent)
    }
  }

  const handleSubmit = async () => {
    if (!isValid || !hasChanges) return

    setIsSubmitting(true)

    try {
      // 변경된 값만 요청 데이터에 포함
      const requestData: { nickname?: string; isMarketing?: boolean } = {}

      if (nickname !== currentNickname) {
        requestData.nickname = nickname
      }
      if (marketingConsent !== isMarketing) {
        requestData.isMarketing = marketingConsent
      }

      // 프로필 수정 API 호출
      const response = await api.patch('/user/change', requestData)
      const user = response.data.data.user

      // userStore 업데이트
      updateUserProfile({
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        isMarketing: user.isMarketing,
      })

      closeModal()
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        if (status === 401) {
          alert('인증이 만료되었습니다. 다시 로그인해주세요.')
          closeModal()
        } else if (status === 409) {
          setNicknameError('이미 사용 중인 닉네임입니다.')
        } else if (status === 400) {
          setNicknameError('유효하지 않은 닉네임 형식입니다.')
        } else if (status === 429) {
          setNicknameError('잠시 후 다시 시도해주세요.')
        } else {
          setNicknameError('프로필 수정에 실패했습니다.')
        }
      } else {
        setNicknameError('프로필 수정에 실패했습니다.')
      }
      console.error('프로필 수정 실패:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAccount = () => {
    closeModal()
    openModal('delete-account')
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="relative bg-[#2b2b2b] w-[90vw] max-w-md rounded-3xl flex flex-col p-8 max-h-[90vh] overflow-y-auto">

        <button
          className="absolute top-6 right-6 text-white text-2xl hover:text-gray-300 transition-colors"
          onClick={closeModal}
        >
          ✕
        </button>

        {/* 상단 - 제목 */}
        <div className="pt-8 pb-6">
          <h2 className="text-2xl font-bold text-white text-center">
            프로필 수정
          </h2>
        </div>

        {/* 프로필 이미지 */}
        <div className="flex flex-col items-center mb-2">
          <div className="relative">
            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <label
              htmlFor="profile-upload"
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#00d9a3] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#00c090] transition-colors"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </label>
            <input
              id="profile-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
          <p className="text-gray-400 text-sm mt-3">프로필 이미지 변경</p>
        </div>

        {/* 이미지 메시지 - 고정 높이 */}
        <div className="h-5 mb-6 text-center">
          {imageError && (
            <p className="text-sm text-[#ff6b6b]">
              {imageError}
            </p>
          )}
          {imageSuccess && !imageError && (
            <p className="text-sm text-[#00d9a3]">
              이미지가 저장되었습니다.
            </p>
          )}
        </div>

        {/* 닉네임 입력 */}
        <div className="mb-2">
          <label className="block text-white text-sm font-medium mb-2">
            닉네임 변경
          </label>
          <div className="relative">
            <input
              type="text"
              value={nickname}
              onChange={(e) => handleNicknameChange(e.target.value)}
              placeholder="닉네임을 입력해주세요."
              className={`
                w-full 
                bg-[#3a3a3a]
                border-0 
                rounded-lg
                px-4
                py-3
                text-base
                outline-none
                placeholder:text-gray-500
                text-white
                ${nickname.length > maxLength || nicknameError
                  ? 'ring-2 ring-[#ff6b6b]'
                  : 'focus:ring-2 focus:ring-[#00d9a3]'}
                transition-all
              `}
            />
            <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm ${nickname.length > maxLength ? 'text-[#ff6b6b]' : 'text-gray-500'
              }`}>
              {nickname.length} / {maxLength}
            </span>
          </div>
        </div>

        {/* 닉네임 에러 메시지 - 고정 높이 */}
        <div className="h-5 mb-6">
          {nicknameError && (
            <p className="text-sm text-[#ff6b6b]">
              {nicknameError}
            </p>
          )}
        </div>

        {/* 마케팅 수신동의 변경 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <label className="text-white text-sm font-medium">
              마케팅 수신동의
            </label>
            <button
              onClick={handleMarketingConsentToggle}
              className={`
                relative
                w-12
                h-6
                rounded-full
                transition-colors
                duration-300
                ${marketingConsent ? 'bg-[#00d9a3]' : 'bg-gray-600'}
              `}
            >
              <span
                className={`
                  absolute
                  top-1
                  left-1
                  w-4
                  h-4
                  bg-white
                  rounded-full
                  shadow-md
                  transition-all
                  duration-300
                  ${marketingConsent ? 'left-7' : 'left-1'}
                `}
              />
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            이벤트 및 프로모션 알림을 받습니다
          </p>
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || !hasChanges || isSubmitting}
          className={`
            w-full
            py-3
            rounded-full
            font-medium
            transition-all
            mb-4
            ${isValid && hasChanges && !isSubmitting
              ? 'bg-[#00d9a3] text-white hover:bg-[#00c090]'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? '저장 중...' : '저장하기'}
        </button>

        {/* 회원탈퇴 버튼 */}
        <button
          onClick={handleDeleteAccount}
          className="w-full text-gray-400 text-sm underline hover:text-white transition-colors"
        >
          회원탈퇴
        </button>
      </div>
    </div>
  )
}

export default ProfilePage