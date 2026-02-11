import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import Random from '../pages/Random';
import Room from '../pages/Room';
import NotFound from '../pages/NotFound';
import MainLayout from '../components/layouts/MainLayout';
import GameLayout from '../components/layouts/GameLayout';
import OAuthCallback from '../pages/oauth/OAuthCallback';
import MatchLoad from '../pages/MatchLoad';
import MatchingScreen from '../pages/MatchingScreen';
import MatchingScreenFriend from '../pages/MatchingScreen_friend';
import Countdown from '../pages/CountDown';
import CheckLayout from '../components/layouts/CheckLayout';
import WebsocketLayout from '../components/layouts/WebsocketLayout';
import BattleGame from '../pages/battleScreen1';
import BattleResult from '../pages/battleResult';
import RoomInvite from '../pages/RoomInvite';
import Download from '../pages/Download';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <NotFound />,
    children: [
      // WebsocketLayout을 최상위에 두어 모든 페이지에서 연결 유지
      {
        element: <WebsocketLayout />,
        children: [
          // 로비/매칭 페이지 - MainLayout (Footer 있음)
          {
            element: <MainLayout />,
            children: [
              {
                // 카메라 프리뷰가 필요한 페이지
                element: <CheckLayout />,
                children: [
                  { index: true, element: <Random /> },
                  { path: 'room', element: <Room /> },
                ]
              },
              { path: 'match-load', element: <MatchLoad /> },
              { path: 'room/invite', element: <RoomInvite /> },
              { path: 'matching-screen/:roomId', element: <MatchingScreen /> },
              { path: 'room/matching/:roomId', element: <MatchingScreenFriend /> },
            ],
          },
          // 대전 화면 - GameLayout (Footer 없음)
          {
            element: <GameLayout />,
            children: [
              { path: 'countdown/:roomId', element: <Countdown /> },
              { path: 'battle/:roomId', element: <BattleGame /> },
              { path: 'battle-result', element: <BattleResult /> },
              // TEST ROUTE
              { path: 'test/countdown', element: <Countdown /> },
            ],
          },
        ],
      },
      // 다운로드 페이지 - WebSocket 불필요
      { path: 'download', element: <Download /> },
    ],
  },
  // OAuth 콜백
  { path: '/oauth2/callback/kakao', element: <OAuthCallback provider="KAKAO" /> },
  { path: '/oauth2/callback/naver', element: <OAuthCallback provider="NAVER" /> },
  { path: '/oauth2/callback/google', element: <OAuthCallback provider="GOOGLE" /> },
]);
