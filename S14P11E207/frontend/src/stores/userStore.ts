// stores/userStore.ts
import { create } from 'zustand';
import { api } from '../lib/axios';

interface LoginData {
    accessToken: string
    refreshToken: string
    nickname?: string
    profileImageUrl?: string
    isMarketing?: boolean
}

interface UserData {
    id: string
    nickname: string
    profileImageUrl: string | null
    isMarketing: boolean
    totalGames: number
    totalWins: number
    totalDraws: number
    totalLosses: number
    currentWinStreak: number
    maxWinStreak: number
    recentResults: string[]
}

interface UserState {
    // 유저 정보
    id: string | null
    nickname: string
    profileImage: string | null
    isMarketing: boolean

    // 인증 토큰
    accessToken: string | null
    refreshToken: string | null

    // 전적 정보
    totalGames: number
    totalWins: number
    totalDraws: number
    totalLosses: number
    currentWinStreak: number
    maxWinStreak: number
    recentResults: string[]

    // 액션
    logout: () => void
    setLoginData: (data: LoginData) => void
    setTokens: (accessToken: string, refreshToken: string) => void
    fetchUserData: () => Promise<void>
    updateMarketingConsent: (consent: boolean) => void
    updateUserProfile: (data: { nickname?: string; profileImageUrl?: string; isMarketing?: boolean }) => void
};

export const userStore = create<UserState>((set, get) => ({
    // 유저 정보 초기값
    id: null,
    nickname: '',
    profileImage: null,
    isMarketing: false,

    // 인증 토큰 초기값
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),

    // 전적 정보 초기값
    totalGames: 0,
    totalWins: 0,
    totalDraws: 0,
    totalLosses: 0,
    currentWinStreak: 0,
    maxWinStreak: 0,
    recentResults: [],

    logout: () => {
        set({
            id: null,
            accessToken: null,
            refreshToken: null,
            nickname: '',
            profileImage: null,
            isMarketing: false,
            totalGames: 0,
            totalWins: 0,
            totalDraws: 0,
            totalLosses: 0,
            currentWinStreak: 0,
            maxWinStreak: 0,
            recentResults: [],
        })
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
    },

    setTokens: (accessToken: string, refreshToken: string) => {
        set({ accessToken, refreshToken })
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
    },

    setLoginData: (data: LoginData) => {
        set({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            nickname: data.nickname || '',
            profileImage: data.profileImageUrl || null,
            ...(data.isMarketing !== undefined && { isMarketing: data.isMarketing }),
        })

        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('refreshToken', data.refreshToken)
    },

    fetchUserData: async () => {
        try {
            const response = await api.get('/user')
            const userData: UserData = response.data.data
            console.log(response)

            set({
                id: userData.id,
                nickname: userData.nickname,
                profileImage: userData.profileImageUrl,
                isMarketing: userData.isMarketing,
                totalGames: userData.totalGames,
                totalWins: userData.totalWins,
                totalDraws: userData.totalDraws,
                totalLosses: userData.totalLosses,
                currentWinStreak: userData.currentWinStreak,
                maxWinStreak: userData.maxWinStreak,
                recentResults: userData.recentResults ?? [],
            })
        } catch (error) {
            console.error('유저 정보 조회 실패:', error)
            throw error
        }
    },

    updateMarketingConsent: (consent: boolean) => {
        set({ isMarketing: consent })
    },

    updateUserProfile: (data: { nickname?: string; profileImageUrl?: string; isMarketing?: boolean }) => {
        set({
            ...(data.nickname !== undefined && { nickname: data.nickname }),
            ...(data.profileImageUrl !== undefined && { profileImage: data.profileImageUrl }),
            ...(data.isMarketing !== undefined && { isMarketing: data.isMarketing }),
        })
    },
}))
