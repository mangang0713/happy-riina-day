/**
 * 이 훅은 글 저장과 사진 업로드처럼 연속된 보호 요청마다 새 토큰을 받습니다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type PendingTokenRequest = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

/** Turnstile 위젯을 초기화하고 다음 일회성 토큰을 기다립니다. */
export function useTurnstileToken() {
  const [token, setToken] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const pendingRequestRef = useRef<PendingTokenRequest | undefined>(undefined);

  const onToken = useCallback((nextToken: string) => {
    setToken(nextToken);
    const pendingRequest = pendingRequestRef.current;
    if (!nextToken || !pendingRequest) return;

    window.clearTimeout(pendingRequest.timeoutId);
    pendingRequestRef.current = undefined;
    pendingRequest.resolve(nextToken);
  }, []);

  const requestFreshToken = useCallback(
    () =>
      new Promise<string>((resolve, reject) => {
        const previousRequest = pendingRequestRef.current;
        if (previousRequest) {
          window.clearTimeout(previousRequest.timeoutId);
          previousRequest.reject(
            new Error('새 보안 확인 요청으로 대체되었습니다.'),
          );
        }

        const timeoutId = window.setTimeout(() => {
          const pendingRequest = pendingRequestRef.current;
          if (!pendingRequest || pendingRequest.timeoutId !== timeoutId) return;
          pendingRequestRef.current = undefined;
          pendingRequest.reject(
            new Error('봇 확인 토큰을 받지 못했습니다. 다시 시도해 주세요.'),
          );
        }, 45_000);

        pendingRequestRef.current = { resolve, reject, timeoutId };
        setToken('');
        setResetKey((key) => key + 1);
      }),
    [],
  );

  const reset = useCallback(() => {
    const pendingRequest = pendingRequestRef.current;
    if (pendingRequest) {
      window.clearTimeout(pendingRequest.timeoutId);
      pendingRequestRef.current = undefined;
      pendingRequest.reject(new Error('봇 확인이 초기화되었습니다.'));
    }
    setToken('');
    setResetKey((key) => key + 1);
  }, []);

  useEffect(
    () => () => {
      const pendingRequest = pendingRequestRef.current;
      if (!pendingRequest) return;
      window.clearTimeout(pendingRequest.timeoutId);
      pendingRequestRef.current = undefined;
      pendingRequest.reject(new Error('봇 확인 화면이 닫혔습니다.'));
    },
    [],
  );

  return { token, resetKey, onToken, requestFreshToken, reset };
}
