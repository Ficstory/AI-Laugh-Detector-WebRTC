
import React, { useEffect, useRef, useState } from 'react';
import { SmileDetector } from '../services/smileDetector';
import type { DetectionResult } from '../services/smileDetector';

const SmileCam: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const detectorRef = useRef<SmileDetector | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [statusText, setStatusText] = useState('Initializing...');
    const [results, setResults] = useState<DetectionResult[]>([]);

    useEffect(() => {
        const setupDetector = async () => {
            if (!videoRef.current) return;

            // 1. SmileDetector 초기화
            detectorRef.current = new SmileDetector();
            try {
                await detectorRef.current.initialize();
                setStatusText('Initialization successful. Requesting camera...');
            } catch (error) {
                setStatusText('Failed to initialize AI model.');
                console.error(error);
                return;
            }
            
            // 2. 웹캠 스트림 가져오기
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 1280, height: 720 } 
                });
                videoRef.current.srcObject = stream;

                // 비디오 메타데이터가 로드된 후 탐지 시작
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    setStatusText('Detecting...');
                    setIsLoading(false);

                    // 3. 탐지 시작 및 결과 콜백 설정
                    detectorRef.current?.start(videoRef.current!, (newResults) => {
                        setResults(newResults);
                    });
                };

            } catch (err) {
                setStatusText('Camera access was denied.');
                console.error("Failed to get camera stream:", err);
            }
        };

        setupDetector();

        // 컴포넌트 unmount 시 정리
        return () => {
            detectorRef.current?.stop();
            const stream = videoRef.current?.srcObject as MediaStream;
            stream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    // 결과가 업데이트될 때마다 캔버스에 그리기
    useEffect(() => {
        if (!canvasRef.current || !videoRef.current) return;

        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // 비디오와 캔버스 크기 맞추기
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px Arial';
        ctx.lineWidth = 2;

        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;

        for (const result of results) {
            const { box, smileProb, emotion, isSmiling, status } = result;

            // 좌표 스케일링
            const x1 = box.x1 * scaleX;
            const y1 = box.y1 * scaleY;
            const w = (box.x2 - box.x1) * scaleX;
            const h = (box.y2 - box.y1) * scaleY;

            ctx.strokeStyle = isSmiling ? '#00FF00' : '#FF0000'; // 웃으면 초록, 아니면 빨강
            ctx.strokeRect(x1, y1, w, h);

            // 텍스트 배경
            const text = `#${result.id} | ${emotion} | ${Math.round(smileProb * 100)}% ${status}`;
            const textMetrics = ctx.measureText(text);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x1, y1 - 22, textMetrics.width + 8, 22);

            // 텍스트
            ctx.fillStyle = isSmiling ? '#00FF00' : '#FFFFFF';
            ctx.fillText(text, x1 + 4, y1 - 5);
        }

    }, [results]);

    return (
        <div style={{ position: 'relative', width: '640px', height: '480px', margin: 'auto' }}>
            {isLoading && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'black', color: 'white',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 10
                }}>
                    <p>{statusText}</p>
                </div>
            )}
            <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', transform: 'scaleX(-1)' }}
                autoPlay
                playsInline
                muted
            />
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    transform: 'scaleX(-1)'
                }}
            />
        </div>
    );
};

export default SmileCam;
