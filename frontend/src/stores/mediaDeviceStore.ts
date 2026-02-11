import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeviceState {
  cameras: MediaDeviceInfo[]
  cameraStream: MediaStream | null
  currentCameraId: string | null
  cameraError: string | null

  loadCameras: () => Promise<void>
  startCamera: (deviceId: string) => Promise<void>
  stopCamera: () => void

  mics: MediaDeviceInfo[]
  micStream: MediaStream | null
  currentMicId: string | null
  micError: string | null

  loadMics: () => Promise<void>
  startMic: (deviceId: string) => Promise<void>
  stopMic: () => void
  setMicId: (deviceId: string) => void

  // 저장된 장치로 자동 연결
  initializeFromStorage: () => Promise<void>
};

const getMediaErrorMessage = (error: unknown, deviceLabel: '카메라' | '마이크') => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return `${deviceLabel} 권한이 필요합니다`
    }
    if (error.name === 'NotFoundError') {
      return `${deviceLabel} 장치를 찾을 수 없습니다`
    }
    if (error.name === 'NotReadableError') {
      return `다른 앱에서 ${deviceLabel}를 사용 중입니다`
    }
    if (error.name === 'SecurityError') {
      return 'HTTPS 환경에서만 장치 사용이 가능합니다'
    }
  }
  return `${deviceLabel} 접근 실패`
}

export const mediaDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      cameras: [],
      cameraStream: null,
      currentCameraId: null,
      cameraError: null,

      loadCameras: async () => {
        try {
          await navigator.mediaDevices.getUserMedia({ video: true })

          const devices = await navigator.mediaDevices.enumerateDevices()

          const videoDevices = devices.filter(
            device => device.kind === 'videoinput'
          )

          set({ cameras: videoDevices, cameraError: null })
        } catch (error) {
          console.error('카메라 로드 실패', error)
          set({
            cameras: [],
            cameraError: getMediaErrorMessage(error, '카메라'),
          })
        }
      },

      startCamera: async (deviceId: string) => {
        try {
          const { cameraStream } = get()

          if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop())
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: deviceId },
            },
          })
          set({
            cameraStream: stream,
            currentCameraId: deviceId,
            cameraError: null,
          })
        } catch (error) {
          console.error('카메라 시작 실패', error)
          set({ cameraError: '카메라 시작에 실패했습니다' })
        }
      },

      stopCamera: () => {
        const { cameraStream } = get()

        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop())
        }

        set({
          cameraStream: null,
          currentCameraId: null,
        })
      },

      mics: [],
      micStream: null,
      currentMicId: null,
      micError: null,

      loadMics: async () => {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true })

          const devices = await navigator.mediaDevices.enumerateDevices()

          const audioDevices = devices.filter(
            device => device.kind === 'audioinput'
          )

          set({ mics: audioDevices, micError: null })
        } catch (error) {
          console.error('마이크 로드 실패', error)
          set({
            mics: [],
            micError: getMediaErrorMessage(error, '마이크'),
          })
        }
      },

      startMic: async (deviceId: string) => {
        try {
          const { micStream } = get()

          if (micStream) {
            micStream.getTracks().forEach(track => track.stop())
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: deviceId },
            },
          })
          set({
            micStream: stream,
            currentMicId: deviceId,
            micError: null,
          })
        } catch (error) {
          console.error('마이크 시작 실패', error)
          set({ micError: '마이크 시작에 실패했습니다' })
        }
      },

      stopMic: () => {
        const { micStream } = get()

        if (micStream) {
          micStream.getTracks().forEach(track => track.stop())
        }

        set({
          micStream: null,
          currentMicId: null,
        })
      },

      setMicId: async (deviceId: string) => {
        set({
          currentMicId: deviceId,
        })
      },

      // 저장된 장치 ID로 자동 연결 시도
      initializeFromStorage: async () => {
        const { currentCameraId, currentMicId, startCamera, startMic } = get()

        if (currentCameraId) {
          try {
            await startCamera(currentCameraId)
          } catch (error) {
            console.error('[MediaDevice] 저장된 카메라 연결 실패:', error)
          }
        }

        if (currentMicId) {
          try {
            await startMic(currentMicId)
          } catch (error) {
            console.error('[MediaDevice] 저장된 마이크 연결 실패:', error)
          }
        }
      },
    }),
    {
      name: 'media-device-storage', // localStorage 키 이름
      partialize: (state) => ({
        // 저장할 상태만 선택 (stream 객체는 저장 불가)
        currentCameraId: state.currentCameraId,
        currentMicId: state.currentMicId,
      }),
    }
  )
);
