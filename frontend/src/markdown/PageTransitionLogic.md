# Page Transition Logic Implementation

This document outlines the changes made to implement the page transition flow from the random battle start to the matching screen.

## 1. Routing Updates (`src/router/index.tsx`)

New routes for `/match-load` and `/matching-screen` were added. These routes are nested within the `MainLayout` to ensure they inherit the common layout, including the navigation and footer.

```tsx
import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import Random from '../pages/Random';
import Room from '../pages/Room';
import NotFound from '../pages/NotFound';
import MainLayout from '../components/layouts/MainLayout';
import OAuthCallback from '../pages/oauth/OAuthCallback';
import MatchLoad from '../pages/MatchLoad';
import MatchingScreen from '../pages/MatchingScreen';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <NotFound />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { index: true, element: <Random /> },
          { path: 'room', element: <Room /> },
          { path: 'match-load', element: <MatchLoad /> },
          { path: 'matching-screen', element: <MatchingScreen /> },
        ],
      },
    ],
  },
  // OAuth 콜백 라우트 (Layout 없이)
  {
    path: '/oauth2/callback/kakao',
    element: <OAuthCallback provider="KAKAO" />,
  },
  {
    path: '/oauth2/callback/naver',
    element: <OAuthCallback provider="NAVER" />,
  },
  {
    path: '/oauth2/callback/google',
    element: <OAuthCallback provider="GOOGLE" />,
  },
]);
```

## 2. `Random.tsx` - Initiating the Battle

The `useNavigate` hook was added to the `Random` component. An `onClick` handler (`handleStartBattle`) was attached to the "랜덤배틀 시작하기" button to navigate the user to the `/match-load` page.

```tsx
// src/pages/Random.tsx

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { mediaDeviceStore } from '../stores/mediaDeviceStore'
import { userStore } from '../stores/userStore'
import { useModalRouter } from '../hooks/useModalRouter'

function Random() {
    const navigate = useNavigate()
    // ... (rest of the component)

    const handleStartBattle = () => {
        navigate('/match-load')
    }

    return (
        <div className='w-[46vw] aspect-[4/3] flex flex-col justify-between'>
            {accessToken !== null ? (
                <>
                    {/* ... (rest of the JSX) */}

                    {/* 하단 - 시작 버튼 */}
                    <div className="pb-6">
                        <button
                            onClick={handleStartBattle}
                            disabled={!currentCameraId || !currentMicId}
                            className={`w-full py-3 rounded-full font-bold transition-all ${currentCameraId && currentMicId
                                    ? 'bg-white text-black hover:bg-gray-100'
                                    : 'bg-gray-700 text-gray-400 cursor-not-allowed text-sm'
                                }`}
                        >
                            {/* ... */}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    {/* ... */}
                </>
            )}
        </div>
    )
}

export default Random
```

## 3. `MatchLoad.tsx` - Timed Navigation

This component now includes a `useEffect` hook that triggers a `setTimeout`. After 5 seconds, it automatically navigates the user to the `/matching-screen`. A cleanup function is included to clear the timeout if the component unmounts. The "매칭 취소" button was also updated to navigate the user back to the main page.

```tsx
// src/pages/MatchLoad.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const MatchLoad: React.FC = () => {
  const [seconds, setSeconds] = useState<number>(0);
  const navigate = useNavigate();

  // 5초 후에 매칭 화면으로 이동
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/matching-screen');
    }, 5000);

    // 컴포넌트 언마운트 시 타이머 클리어
    return () => clearTimeout(timer);
  }, [navigate]);

  // 경과 시간 표시용
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCancel = () => {
    navigate('/'); // 메인 페이지 또는 이전 페이지로 이동
  };

  // ... (rest of the component)
  
  return (
    // ... (JSX with onClick={handleCancel} on the cancel button)
  )
};

export default MatchLoad;
```

## 4. `MatchingScreen.tsx` - Layout Adjustment

The component was refactored to remove its own full-screen layout (`<div className="min-h-screen...">` and `<main>...</main>`). It now returns a React fragment (`<>...</>`), allowing it to be correctly embedded within the `MainLayout`'s `<Outlet />`. This ensures the page has the standard navigation and footer.

```tsx
// src/pages/MatchingScreen.tsx

// ... (imports and sub-components)

const MatchingScreen: React.FC = () => {
  // ... (state and logic)

  return (
    <>
        {/* 플레이어 화면 컨테이너 */}
        <div className="flex flex-col lg:flex-row gap-6 mb-10 max-w-[1400px] w-full">
          {/* ... (Player screens) */}
        </div>

        {/* 컨트롤 바 */}
        <div className="flex gap-5 items-center flex-wrap justify-center">
          {/* ... (Buttons) */}
        </div>

        {/* ... (Countdown overlay) */}
    </>
  );
};

export default MatchingScreen;
```
