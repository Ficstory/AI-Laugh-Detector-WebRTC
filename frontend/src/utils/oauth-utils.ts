import { api } from '../lib/axios'

// OAuth 설정
const OAUTH_CONFIG = {
  KAKAO: {
    clientId: import.meta.env.VITE_KAKAO_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/oauth2/callback/kakao`,
    authUrl: 'https://kauth.kakao.com/oauth/authorize',
  },
  NAVER: {
    clientId: import.meta.env.VITE_NAVER_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/oauth2/callback/naver`,
    authUrl: 'https://nid.naver.com/oauth2.0/authorize',
  },
  GOOGLE: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/oauth2/callback/google`,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  },
}

// OAuth 로그인 시작
export const initiateOAuthLogin = (provider: 'KAKAO' | 'NAVER' | 'GOOGLE') => {
  const config = OAUTH_CONFIG[provider]

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
  })

  // 각 플랫폼별 추가 파라미터
  if (provider === 'NAVER') {
    params.append('state', 'E207')
  } else if (provider === 'GOOGLE') {
    params.append('scope', 'email profile')
  }

  window.location.href = `${config.authUrl}?${params.toString()}`
}

// 백엔드 OAuth 로그인 API 호출 (POST /auth/login)
export const oauthLogin = async (
  oauthProvider: 'KAKAO' | 'NAVER' | 'GOOGLE',
  authorizationCode: string,
) => {
  const redirectUri = OAUTH_CONFIG[oauthProvider].redirectUri

  const response = await api.post('/auth/login', {
    oauthProvider,
    authorizationCode,
    redirectUri,
  })

  return response.data
}
