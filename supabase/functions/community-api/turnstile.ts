/**
 * 이 모듈은 게시물 작성·수정에 필요한 Cloudflare Turnstile 검증을 담당합니다.
 */

import { HttpError } from './http.ts';

type TurnstileOptions = {
  secret?: string;
  allowedOrigins: ReadonlySet<string>;
  fetcher?: typeof fetch;
};

/** Siteverify 응답을 확인하고, 실패하거나 검증할 수 없으면 요청을 차단합니다. */
export async function verifyTurnstile(
  request: Request,
  token: unknown,
  { secret, allowedOrigins, fetcher = fetch }: TurnstileOptions,
) {
  if (!secret) {
    throw new HttpError(
      503,
      'BOT_CHECK_UNAVAILABLE',
      '봇 확인 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (typeof token !== 'string' || token.length < 10) {
    throw new HttpError(400, 'BOT_CHECK_REQUIRED', '봇 확인을 완료해 주세요.');
  }

  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.set('remoteip', ip);

  let response: Response;
  try {
    response = await fetcher(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    throw new HttpError(
      503,
      'BOT_CHECK_UNAVAILABLE',
      '봇 확인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (!response.ok) {
    console.error('Turnstile Siteverify returned a non-success status', {
      status: response.status,
    });
    throw new HttpError(
      503,
      'BOT_CHECK_UNAVAILABLE',
      '봇 확인 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.',
    );
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new HttpError(
      503,
      'BOT_CHECK_UNAVAILABLE',
      '봇 확인 서버의 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }

  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    typeof (result as { success?: unknown }).success !== 'boolean'
  ) {
    throw new HttpError(
      503,
      'BOT_CHECK_UNAVAILABLE',
      '봇 확인 서버의 응답 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.',
    );
  }

  const siteverify = result as { success: boolean; hostname?: unknown };
  if (!siteverify.success) {
    throw new HttpError(
      403,
      'BOT_CHECK_FAILED',
      '봇 확인에 실패했습니다. 다시 시도해 주세요.',
    );
  }
  if (typeof siteverify.hostname !== 'string' || !siteverify.hostname) {
    throw new HttpError(
      503,
      'BOT_CHECK_UNAVAILABLE',
      '봇 확인 서버의 응답 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.',
    );
  }

  const allowedHosts = new Set(
    [...allowedOrigins].map((value) => new URL(value).hostname),
  );
  if (!allowedHosts.has(siteverify.hostname)) {
    throw new HttpError(
      403,
      'BOT_CHECK_FAILED',
      '봇 확인에 실패했습니다. 다시 시도해 주세요.',
    );
  }
}
