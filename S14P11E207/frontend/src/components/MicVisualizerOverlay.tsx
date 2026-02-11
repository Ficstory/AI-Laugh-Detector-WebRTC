// components/MicVisualizerOverlay.tsx (새 파일)
import { useEffect, useRef } from 'react'

interface MicVisualizerOverlayProps {
  micStream: MediaStream | null
  onConfirm: () => void
  onCancel: () => void
}

function MicVisualizerOverlay({
  micStream,
  onConfirm,
  onCancel
}: MicVisualizerOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationIdRef = useRef<number | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  useEffect(() => {
    if (!micStream || !canvasRef.current) return

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    const audioContext = audioContextRef.current
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048

    const source = audioContext.createMediaStreamSource(micStream)
    source.connect(analyser)

    sourceRef.current = source
    analyserRef.current = analyser

    const visualize = () => {
      if (!analyserRef.current || !canvasRef.current) return

      const canvas = canvasRef.current
      const canvasCtx = canvas.getContext('2d')
      if (!canvasCtx) return

      const analyser = analyserRef.current
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const draw = () => {
        animationIdRef.current = requestAnimationFrame(draw)

        analyser.getByteTimeDomainData(dataArray)

        canvasCtx.fillStyle = 'rgb(0, 0, 0)'
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height)

        canvasCtx.lineWidth = 2
        canvasCtx.strokeStyle = 'rgb(16, 185, 129)'
        canvasCtx.beginPath()

        const sliceWidth = canvas.width / bufferLength
        let x = 0

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0
          const y = (v * canvas.height) / 2

          if (i === 0) {
            canvasCtx.moveTo(x, y)
          } else {
            canvasCtx.lineTo(x, y)
          }

          x += sliceWidth
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2)
        canvasCtx.stroke()
      }

      draw()
    }

    visualize()  // 바로 호출

    // Cleanup
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
        animationIdRef.current = null
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect()
        sourceRef.current = null
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }

      analyserRef.current = null
    }
  }, [micStream])

  return (
    <div className="absolute inset-0 z-10 bg-black/50 rounded-lg flex flex-col items-center justify-center p-4">
      <div className="bg-black rounded-lg p-4 w-full max-w-md">
        <h3 className="text-white text-center mb-2">마이크 테스트</h3>
        <canvas
          ref={canvasRef}
          width={400}
          height={100}
          className="w-full rounded bg-black"
        />
        <p className="text-white text-sm text-center mt-2">
          말을 해보세요. 파형이 움직이면 마이크가 정상 작동 중입니다.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            className="flex-1 bg-[#00d9a3] text-white px-4 py-2 rounded hover:bg-[#00c090]"
            onClick={onConfirm}
          >
            선택
          </button>
        </div>
      </div>
    </div>
  )
}

export default MicVisualizerOverlay