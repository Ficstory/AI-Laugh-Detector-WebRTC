import { useEffect, useState, useCallback, useRef } from 'react';

const WARNING_DELAY_MS = 3000; // 3초 후 경고 표시
const FOCUS_TIMEOUT_MS = 8000; // 8초 후 패배

/**
 * 스크린 캡처 감지 시 경고 모달을 제어하는 커스텀 훅
 * - Win+Shift+S (keydown으로 키 수집 → keyup으로 조합 판별)
 * - PrintScreen (keyup)
 * - 포커스 잃음 감지 (blur/focus)
 * - 3초 후 경고 표시, 8초 내 미복귀 시 focusTimedOut 발생
 */
export function useBlockCapture() {
  const [open, setOpen] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const [focusWarning, setFocusWarning] = useState(false);
  const [focusTimedOut, setFocusTimedOut] = useState(false);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const warn = () => setOpen(true);
    const pressed = new Set<string>();

    const clearTimers = () => {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      pressed.add(e.key);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressed.add(e.key);

      const hasWinShiftS = pressed.has('Meta') && pressed.has('Shift') && (pressed.has('s') || pressed.has('S'));
      const hasPrintScreen = e.key === 'PrintScreen';

      if (hasWinShiftS || hasPrintScreen) {
        warn();
      }

      pressed.delete(e.key);
    };

    const onBlur = () => {
      pressed.clear();
      setBlurred(true);

      // 3초 후 경고 표시
      warningTimerRef.current = setTimeout(() => {
        setFocusWarning(true);
      }, WARNING_DELAY_MS);

      // 8초 후 패배 처리
      timeoutTimerRef.current = setTimeout(() => {
        setFocusTimedOut(true);
        setBlurred(false);
        setFocusWarning(false);
      }, FOCUS_TIMEOUT_MS);
    };

    const onFocus = () => {
      clearTimers();
      setBlurred(false);
      setFocusWarning(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      clearTimers();
    };
  }, []);

  return { open, close, blurred, focusWarning, focusTimedOut };
}
