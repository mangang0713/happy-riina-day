/**
 * 이 컴포넌트는 커뮤니티 제출 전에 Cloudflare Turnstile 확인 토큰을 받습니다.
 */

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback': () => void;
          'error-callback': () => void;
          theme: 'light';
          appearance?: 'always' | 'execute' | 'interaction-only';
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
let loader: Promise<void> | undefined;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!loader) {
    loader = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-turnstile-loader]',
      );
      const script = existing ?? document.createElement('script');
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstileLoader = 'true';
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('봇 확인 도구를 불러오지 못했습니다.'));
      if (!existing) document.head.append(script);
    }).catch((error: unknown) => {
      loader = undefined;
      throw error;
    });
  }
  return loader;
}

/** 글쓰기 요청 전에 서버가 검증할 일회성 봇 확인 토큰을 받아 전달합니다. */
function TurnstileWidget({
  onToken,
  resetKey = 0,
  appearance = 'always',
}: {
  onToken: (token: string) => void;
  resetKey?: number;
  appearance?: 'always' | 'execute' | 'interaction-only';
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const lastResetKeyRef = useRef(resetKey);
  const [error, setError] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    if (!siteKey || !container) return;
    setError('');
    let active = true;
    loadTurnstile()
      .then(() => {
        const turnstile = window.turnstile;
        if (!active || !turnstile || !container) return;
        widgetIdRef.current = turnstile.render(container, {
          sitekey: siteKey,
          theme: 'light',
          callback: onToken,
          'expired-callback': () => onToken(''),
          'error-callback': () => {
            onToken('');
            setError('봇 확인을 다시 진행해 주세요.');
          },
          appearance,
        });
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : '봇 확인을 불러오지 못했습니다.',
        ),
      );
    return () => {
      active = false;
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      }
      onToken('');
    };
  }, [appearance, onToken]);

  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) return;
    lastResetKeyRef.current = resetKey;
    const widgetId = widgetIdRef.current;
    if (!widgetId) return;

    setError('');
    window.turnstile?.reset(widgetId);
  }, [resetKey]);

  if (!siteKey) {
    return (
      <p className="community-small">
        Turnstile 사이트 키가 설정되면 봇 확인이 표시됩니다.
      </p>
    );
  }
  return (
    <div>
      <div ref={containerRef} />
      {error && (
        <p className="community-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default TurnstileWidget;
