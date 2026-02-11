import { useEffect, useRef, memo } from 'react';
import type { StreamManager } from 'openvidu-browser';

interface VideoElementProps {
  streamManager: StreamManager;
}

const VideoElement = memo(({ streamManager }: VideoElementProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // connection.data에서 닉네임과 아이디 추출
  const connection = streamManager.stream.connection;
  let userId: string | null = null;
  let nickname = '';
  if (connection.data) {
    const dataParts = connection.data.split('%/%');
    try {
      const serverDataJson = JSON.parse(dataParts[0]);
      userId = serverDataJson.userId;
      nickname = serverDataJson.nickname || 'Unknown';
    } catch {
      nickname = 'Unknown';
    }
  }

  useEffect(() => {
    if (streamManager && videoRef.current) {
      streamManager.addVideoElement(videoRef.current);
    }
  }, [streamManager]);

  return (
    <div className="relative m-1">
      <video
        autoPlay
        ref={videoRef}
        className="w-[300px] rounded-lg bg-black"
      />
      <div className="absolute bottom-2.5 left-2.5 text-white bg-black/60 px-2 py-0.5 rounded">
        <p className="m-0 text-sm">{nickname}{userId ? ` (${userId.slice(0, 8)}...)` : ''}</p>
      </div>
    </div>
  );
});

VideoElement.displayName = 'VideoElement';

export default VideoElement;
