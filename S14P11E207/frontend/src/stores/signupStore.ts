import { create } from 'zustand'

interface SignupState {
  nickname: string
  profileImage: File | null
  profileImageObjectKey: string | null
  isNicknameComplete: boolean
  isProfileComplete: boolean

  setNickname: (nickname: string) => void
  setProfileImage: (image: File | null) => void
  setProfileImageObjectKey: (objectKey: string | null) => void
  completeNickname: () => void
  completeProfile: () => void
  reset: () => void
}

export const signupStore = create<SignupState>((set) => ({
  nickname: '',
  profileImage: null,
  profileImageObjectKey: null,
  isNicknameComplete: false,
  isProfileComplete: false,

  setNickname: (nickname) => set({ nickname }),
  setProfileImage: (profileImage) => set({ profileImage }),
  setProfileImageObjectKey: (profileImageObjectKey) => set({ profileImageObjectKey }),
  completeNickname: () => set({ isNicknameComplete: true }),
  completeProfile: () => set({ isProfileComplete: true }),
  reset: () => set({
    nickname: '',
    profileImage: null,
    profileImageObjectKey: null,
    isNicknameComplete: false,
    isProfileComplete: false,
  })
}))