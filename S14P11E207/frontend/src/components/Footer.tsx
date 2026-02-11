const footerLinks = [
    { label: "서비스 소개", href: "https://ryuwon-project.notion.site/2f7a58d49be6802187f9fb3582e36401?pvs=74" },
    { label: "이용약관", href: "https://ryuwon-project.notion.site/2f7a58d49be6819ba2ddf1dc505e19c9" },
    { label: "개인정보처리방침", href: "https://ryuwon-project.notion.site/2f7a58d49be681e38f88f2b9502ab0b6?pvs=74" },
    { label: "커뮤니티 가이드라인", href: "https://ryuwon-project.notion.site/2f7a58d49be6812ebdaaf7e31f310402?pvs=74" },
    { label: "운영 정책(제재, 신고, 처리절차)", href: "https://ryuwon-project.notion.site/2f7a58d49be6808a9eb8fb6bd43f02d8?pvs=74" },
]

function Footer() {
    return (
        <footer className="bg-zinc-900 text-zinc-100">
            <div className="mx-auto w-full max-w-6xl px-6 py-12">
                <div className="flex flex-col items-center gap-6 text-center">
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">
                            SSAFY E207
                        </p>
                        <h3 className="text-2xl font-semibold text-white">
                            휴먼굴림체
                        </h3>
                    </div>

                    <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-zinc-300">
                        {footerLinks.map((link, index) => (
                            <span key={link.label} className="flex items-center">
                                <a
                                    href={link.href}
                                    className="transition-colors hover:text-white"
                                >
                                    {link.label}
                                </a>
                                {index < footerLinks.length - 1 && (
                                    <span className="mx-2 text-zinc-600">|</span>
                                )}
                            </span>
                        ))}
                    </nav>

                    <div className="text-xs text-zinc-400">
                        <p>
                            팀명 : E207 | 이메일: dlwo4367@gmail.com | 주소: 부산시 강서구
                        </p>
                        <p>
                            본 사이트는 SSAFY 14기 교육 과정 중 제작된 포트폴리오용 프로젝트입니다
                        </p>
                    </div>

                    <p className="text-xs text-zinc-500">
                        © 2026 E207 휴먼굴림체 . All rights reserved. SSAFY 14기 공통 프로젝트
                    </p>
                </div>
            </div>
        </footer>
    )
}

export default Footer
