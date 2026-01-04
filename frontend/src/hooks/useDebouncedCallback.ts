import { useCallback, useRef, useEffect } from 'react';

/**
 * Returns a debounced version of the callback that delays invocation
 * until `delay` ms have passed since the last call.
 *
 * The callback always uses the latest values (no stale closures).
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always keep the ref up to date with the latest callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;

  return debouncedCallback;
}

/**
 * Cancels any pending debounced call and triggers immediately.
 * Useful for "save now" or cleanup scenarios.
 */
export function useDebouncedCallbackWithFlush<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): { debouncedCallback: T; flush: () => void; cancel: () => void } {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<Parameters<T> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    pendingArgsRef.current = args;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
      pendingArgsRef.current = null;
    }, delay);
  }, [delay]) as T;

  const flush = useCallback(() => {
    if (timeoutRef.current && pendingArgsRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      callbackRef.current(...pendingArgsRef.current);
      pendingArgsRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      pendingArgsRef.current = null;
    }
  }, []);

  return { debouncedCallback, flush, cancel };
}
