import { useModalRouter } from "../../hooks/useModalRouter"
import { initiateOAuthLogin } from "../../utils/oauth-utils"
import { RiKakaoTalkFill } from "react-icons/ri"
import { SiNaver } from "react-icons/si"
import googleLogo from "../../assets/brand/google-logo.png.png"

function Login() {
  const { closeModal } = useModalRouter()

  const handleKakaoLogin = () => {
    initiateOAuthLogin('KAKAO')
  }

  const handleNaverLogin = () => {
    initiateOAuthLogin('NAVER')
  }

  const handleGoogleLogin = () => {
    initiateOAuthLogin('GOOGLE')
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[2100]">
      <div className="relative bg-[#2b2b2b] w-[90vw] max-w-96 h-[600px] rounded-3xl flex flex-col p-8">
        <button
          className="absolute top-6 right-6 text-white text-2xl"
          onClick={closeModal}
        >
          ✕
        </button>

        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-gray-300 text-lg font-bold mb-4">
            친구들과 즐기는 웃음배틀
          </p>

          <div className="mb-12">
            <span
              className="text-7xl font-bold text-[#00FF88]"
              style={{ fontFamily: 'SBAggroB, sans-serif', letterSpacing: '-0.2em' }}
            >
              ㅇㅈㅁ
            </span>
          </div>
        </div>

        <div className="w-full px-4 space-y-3 mb-8">
          <button
            onClick={handleKakaoLogin}
            className="w-full h-12 bg-[#FEE500] hover:bg-[#F5DC00] hover:scale-[1.02] hover:shadow-lg rounded-[12px] flex items-center justify-center gap-2 transition-all duration-200"
          >
            <RiKakaoTalkFill className="text-xl text-black" />
            <span className="text-black/85 font-medium text-sm">카카오 로그인</span>
          </button>

          <button
            onClick={handleNaverLogin}
            className="w-full h-12 bg-[#03C75A] hover:bg-[#02B350] hover:scale-[1.02] hover:shadow-lg rounded-[12px] flex items-center justify-center gap-2 transition-all duration-200"
          >
            <SiNaver className="text-sm text-white" />
            <span className="text-white font-medium text-sm">네이버 로그인</span>
          </button>

          <button
            onClick={handleGoogleLogin}
            className="w-full h-12 bg-white hover:bg-gray-100 hover:scale-[1.02] hover:shadow-lg rounded-[12px] flex items-center justify-center gap-2 transition-all duration-200 border border-[#747775]"
            style={{ fontFamily: 'Roboto, sans-serif' }}
          >
            <img src={googleLogo} alt="Google" className="w-5 h-5" />
            <span className="text-[#1F1F1F] font-medium text-sm">Google로 로그인</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
