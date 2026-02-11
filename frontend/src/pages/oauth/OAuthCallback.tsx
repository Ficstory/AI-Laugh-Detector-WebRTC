// src/pages/oauth/OAuthCallback.tsx
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { userStore } from '../../stores/userStore'
import { oauthLogin } from '../../utils/oauth-utils'

interface OAuthCallbackProps {
  provider: 'KAKAO' | 'NAVER' | 'GOOGLE'
}

function OAuthCallback({ provider }: OAuthCallbackProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setLoginData } = userStore()
  const processed = useRef(false)

  useEffect(() => {
    // StrictMode 이중 실행 방지
    if (processed.current) return
    processed.current = true

    const code = searchParams.get('code')
    const oauthError = searchParams.get('error')

    // 1) OAuth 에러
    if (oauthError) {
      alert(`로그인 실패: ${oauthError}`)
      navigate('/', { replace: true })
      return
    }

    // 2) OAuth 제공자에서 code를 받은 경우: 백엔드 API 호출
    if (code) {
      const handleOAuthLogin = async () => {
        try {
          console.log('OAuth 로그인 요청:', { provider, code })
          const response = await oauthLogin(provider, code)
          console.log('OAuth 로그인 응답:', response)

          const data = response.data || response

          // 기존 유저: accessToken 있음 (200 응답)
          if (data.accessToken) {
            setLoginData({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken || '',
              nickname: data.user?.nickname || '',
              profileImageUrl: data.user?.profileImageUrl || '',
            })

            const redirectPath = sessionStorage.getItem('postLoginRedirect')
            if (redirectPath) {
              sessionStorage.removeItem('postLoginRedirect')
              navigate(redirectPath, { replace: true })
            } else {
              navigate('/', { replace: true })
            }
            return
          }

          // 예상치 못한 응답
          alert('로그인 처리 중 오류가 발생했습니다.')
          navigate('/', { replace: true })
        } catch (error: unknown) {
          // 404 응답: 회원가입 필요
          if (error instanceof Error && 'response' in error) {
            const axiosError = error as { response?: { status?: number; data?: { data?: { registerToken?: string } } } }
            if (axiosError.response?.status === 404) {
              const registerToken = axiosError.response?.data?.data?.registerToken
              if (registerToken) {
                console.log('신규 유저 - 회원가입 필요')
                sessionStorage.setItem('registerToken', registerToken)
                navigate('/?modal=signup-nickname', { replace: true })
                return
              }
            }
          }

          console.error('OAuth 로그인 실패:', error)
          alert('로그인에 실패했습니다. 다시 시도해주세요.')
          navigate('/', { replace: true })
        }
      }

      handleOAuthLogin()
      return
    }

    // code가 없는 경우
    alert('인증 정보를 받지 못했습니다.')
    navigate('/', { replace: true })
  }, [searchParams, navigate, setLoginData, provider])

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default OAuthCallback
