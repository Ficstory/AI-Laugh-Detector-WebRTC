import { Outlet } from "react-router-dom"
import Navigation from "../Navigation"

/**
 * GameLayout - 대전 화면용 레이아웃
 * Footer 없이 전체 화면을 활용
 * 사용: /countdown/*, /battle/*, /battle-result 페이지
 */
function GameLayout() {
    return (
        <div className="min-h-dvh flex flex-col">
            <Navigation />
            <div className="flex-1 w-full flex flex-col items-center justify-center px-[clamp(16px,3vw,48px)] py-[clamp(24px,4vh,48px)]">
                <Outlet />
            </div>
        </div>
    )
}

export default GameLayout
