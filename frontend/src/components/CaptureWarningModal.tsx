interface Props {
  open: boolean;
  onClose: () => void;
}

export function CaptureWarningModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-[6px] flex items-center justify-center z-[9999]">
      <div
        className="w-[360px] p-7 rounded-[14px] bg-[#1c1c22] text-[#f1f1f1] shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-center animate-popup"
      >
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold mb-3">화면 캡처가 감지되었습니다</h2>
        <p className="text-sm leading-relaxed text-[#cfcfd4] mb-5">
          이 화면에는 개인 정보가 포함되어 있습니다.
          <br />
          무단 캡처 및 유포 시 법적 책임이<br /> 발생할 수 있습니다.
        </p>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-[10px] border-none bg-[#e54848] hover:bg-[#ff5f5f] text-white font-semibold cursor-pointer transition-colors duration-150"
        >
          확인
        </button>
      </div>
    </div>
  );
}
