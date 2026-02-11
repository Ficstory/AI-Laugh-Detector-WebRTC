import { Outlet } from "react-router-dom"
import VideoPreview from "../VideoPreview"

function CheckLayout() {
    return (

        <div className="grid w-full gap-2 md:grid-cols-2 md:items-stretch lg:gap-6 h-auto">
            {/* 좌측 비디오 확인 - 뷰포트 안에 맞춤 */}
            <div className="w-full shrink-0">
                <VideoPreview className="w-full aspect-[4/3] md:aspect-[4/5] max-h-[30vh] md:max-h-[calc(100dvh-160px)]" />
            </div>

            {/* 우측 Random 혹은 Room 정보 - 모바일에서도 표시 */}
            <div className="w-full flex-1 flex flex-col min-h-0">
                <Outlet />
            </div>
        </div>
    )
}

export default CheckLayout

