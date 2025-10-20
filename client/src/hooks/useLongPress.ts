import { useCallback, useRef, useState } from 'react';

interface UseLongPressOptions {
  onLongPress: (id?: string) => void;
  duration?: number;
  onStart?: (id?: string) => void;
  onEnd?: () => void;
}

export const useLongPress = ({
  onLongPress,
  duration = 3000,
  onStart,
  onEnd
}: UseLongPressOptions) => {
  const [isPressed, setIsPressed] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const start = useCallback(() => {
    setIsPressed(true);
    setProgress(0);
    startTimeRef.current = Date.now();
    onStart?.();

    // Start progress tracking
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(newProgress);
      }
    }, 16); // ~60fps

    // Set timeout for long press completion
    timeoutRef.current = setTimeout(() => {
      onLongPress();
      setIsPressed(false);
      setProgress(0);
      onEnd?.();
    }, duration);
  }, [onLongPress, duration, onStart, onEnd]);

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPressed(false);
    setProgress(0);
    onEnd?.();
  }, [onEnd]);

  const mouseHandlers = {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
  };

  const touchHandlers = {
    onTouchStart: start,
    onTouchEnd: stop,
  };

  return {
    ...mouseHandlers,
    ...touchHandlers,
    isPressed,
    progress,
  };
};
