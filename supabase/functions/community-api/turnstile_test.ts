import { HttpError } from './http.ts';
import { verifyTurnstile } from './turnstile.ts';

const origins = new Set(['https://archive.example']);

function request() {
  return new Request('https://edge.example', {
    headers: { 'CF-Connecting-IP': '192.0.2.10' },
  });
}

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error('Expected ' + String(expected) + ', got ' + String(actual));
  }
}

async function assertHttpError(
  run: () => Promise<unknown>,
  status: number,
  code: string,
) {
  try {
    await run();
  } catch (error) {
    if (!(error instanceof HttpError)) {
      throw new Error('Expected HttpError', { cause: error });
    }
    assertEqual(error.status, status);
    assertEqual(error.code, code);
    return;
  }
  throw new Error('Expected the request to fail');
}

Deno.test(
  'Turnstile secret이 없으면 보호 요청을 fail-closed로 차단한다',
  async () => {
    await assertHttpError(
      () =>
        verifyTurnstile(request(), 'valid-token-value', {
          secret: '',
          allowedOrigins: origins,
          fetcher: () => Promise.reject(new Error('fetch should not run')),
        }),
      503,
      'BOT_CHECK_UNAVAILABLE',
    );
  },
);

Deno.test(
  'Turnstile 토큰이 없거나 짧으면 Siteverify를 호출하지 않는다',
  async () => {
    await assertHttpError(
      () =>
        verifyTurnstile(request(), '', {
          secret: 'test-secret',
          allowedOrigins: origins,
          fetcher: () => Promise.reject(new Error('fetch should not run')),
        }),
      400,
      'BOT_CHECK_REQUIRED',
    );
  },
);

Deno.test('허용된 호스트에서 성공한 Siteverify 응답을 통과시킨다', async () => {
  await verifyTurnstile(request(), 'valid-token-value', {
    secret: 'test-secret',
    allowedOrigins: origins,
    fetcher: () =>
      Promise.resolve(
        Response.json({ success: true, hostname: 'archive.example' }),
      ),
  });
});

Deno.test('잘못된 토큰 또는 허용되지 않은 호스트는 거부한다', async () => {
  for (const result of [
    { success: false, hostname: 'archive.example' },
    { success: true, hostname: 'attacker.example' },
  ]) {
    await assertHttpError(
      () =>
        verifyTurnstile(request(), 'valid-token-value', {
          secret: 'test-secret',
          allowedOrigins: origins,
          fetcher: () => Promise.resolve(Response.json(result)),
        }),
      403,
      'BOT_CHECK_FAILED',
    );
  }
});

Deno.test(
  'Siteverify 비정상 상태·연결 실패·잘못된 JSON은 일시 장애로 처리한다',
  async () => {
    const failures: Array<typeof fetch> = [
      () => Promise.resolve(new Response('unavailable', { status: 503 })),
      () => Promise.reject(new Error('simulated connection failure')),
      () => Promise.resolve(new Response('{invalid json', { status: 200 })),
      () => Promise.resolve(Response.json({ success: 'yes' })),
      () => Promise.resolve(Response.json({ success: true })),
      () => Promise.resolve(Response.json(null)),
    ];

    for (const fetcher of failures) {
      await assertHttpError(
        () =>
          verifyTurnstile(request(), 'valid-token-value', {
            secret: 'test-secret',
            allowedOrigins: origins,
            fetcher,
          }),
        503,
        'BOT_CHECK_UNAVAILABLE',
      );
    }
  },
);
