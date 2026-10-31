import type { WorkerEnv } from './env';

export type TurnstileResult = 'verified' | 'rejected' | 'unavailable';

type SiteverifyPayload = {
  success?: unknown;
  hostname?: unknown;
};

/** 일회용 봇 확인 토큰을 검증합니다. secret은 서버에만 두고 장애 때도 쓰기를 허용하지 않습니다. */
export async function verifyTurnstile(
  env: WorkerEnv,
  token: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET_KEY;
  // 설정 누락은 보호를 끄는 대신 서비스 사용 불가로 처리합니다.
  if (!secret) return 'unavailable';
  if (!token || token.length > 2048) return 'rejected';

  let expectedHostname: string;
  try {
    expectedHostname = new URL(env.APP_ORIGIN).hostname;
  } catch {
    return 'unavailable';
  }

  const form = new URLSearchParams({ secret, response: token });
  try {
    const response = await fetcher(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok) return 'unavailable';

    let payload: SiteverifyPayload;
    try {
      payload = (await response.json()) as SiteverifyPayload;
    } catch {
      return 'unavailable';
    }
    if (typeof payload.success !== 'boolean') return 'unavailable';
    if (!payload.success) return 'rejected';
    // 다른 사이트에서 발급된 유효 토큰을 재사용하지 못하게 서비스 호스트도 확인합니다.
    return payload.hostname === expectedHostname ? 'verified' : 'rejected';
  } catch {
    return 'unavailable';
  }
}
