import { Outlet } from "react-router-dom"
import Navigation from "../Navigation"
import Footer from "../Footer"

function MainLayout() {
    return (
        <div className="flex flex-col">
            <Navigation />
            {/* 콘텐츠 영역: 뷰포트 높이를 채우고 콘텐츠를 수직 중앙 정렬 */}
            <main className="min-h-[calc(100dvh-64px)] w-full flex flex-col items-center justify-center px-[clamp(16px,3vw,48px)] py-[clamp(24px,4vh,48px)]">
                <Outlet />
            </main>
            <Footer />
        </div>
    )
}


export default MainLayout
