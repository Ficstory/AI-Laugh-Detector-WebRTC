import { Outlet } from 'react-router-dom'
import Login from './components/auth/Login'
import Nickname from './components/auth/SignupNickname'
import { useModalRouter } from './hooks/useModalRouter'

import SignupProfile from './components/auth/SignupProfile'
import SignupTerms from './components/auth/SignupTerms'
import SignupSuccess from './components/auth/SignupSuccess'
import ProfilePage from './components/ProfilePage'
import DeleteAccount from './components/auth/DeleteAccount'

function App() {
  const { modal } = useModalRouter()


  return (
    <div className="bg-black min-h-screen flex flex-col">

      <div className={modal ? 'pointer-events-none' : undefined}>
        <Outlet />
      </div>

      {modal && (
        <div className='fixed inset-0 bg-black/40 flex items-center justify-center z-[2000] pointer-events-auto'>
          {/* 로그인 모달 */}
          {modal === 'login' && (
            <Login />
          )}
          {/* 회원가입 닉네임 설정 모달 */}
          {modal === 'signup-nickname' && (
            <Nickname />
          )}

          {/* 회원가입 프로필 이미지 설정 모달 */}
          {modal === 'signup-profile' && (
            <SignupProfile />
          )}

          {/* 회원가입 약관 동의 모달 */}
          {modal === 'signup-terms' && (
            <SignupTerms />
          )}

          {/* 회원가입 성공 모달 */}
          {modal === 'signup-success' && (
            <SignupSuccess />
          )}

          {/* 프로필 페이지 모달 */}
          {modal === 'profile-page' && (
            <ProfilePage />
          )}

          {/* 회원탈퇴 페이지 모달 */}
          {modal === 'delete-account' && (
            <DeleteAccount />
          )}
        </div>
      )}
    </div>
  )
}

export default App
