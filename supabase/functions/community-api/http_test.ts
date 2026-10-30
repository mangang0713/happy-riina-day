import { createHttpHelpers, getBearer, HttpError, text } from './http.ts';

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test(
  'JSON 응답은 허용된 origin과 개인정보 캐시 방지 헤더를 설정한다',
  async () => {
    const { respond } = createHttpHelpers(new Set(['https://archive.example']));
    const response = respond({ ok: true }, 201, 'https://archive.example');

    assertEqual(response.status, 201);
    assertEqual(
      response.headers.get('Access-Control-Allow-Origin'),
      'https://archive.example',
    );
    assertEqual(response.headers.get('Cache-Control'), 'no-store');
    assertEqual(await response.json().then((body) => body.ok), true);
  },
);

Deno.test('허용되지 않은 origin에는 CORS 허용 헤더를 내보내지 않는다', () => {
  const { corsHeaders } = createHttpHelpers(
    new Set(['https://archive.example']),
  );
  const headers = corsHeaders('https://untrusted.example');

  assertEqual(headers.has('Access-Control-Allow-Origin'), false);
});

Deno.test('Bearer 인증 헤더에서만 로그인 토큰을 읽는다', () => {
  assertEqual(
    getBearer(
      new Request('https://edge.example', {
        headers: { Authorization: 'Bearer token-value' },
      }),
    ),
    'token-value',
  );
  assertEqual(
    getBearer(
      new Request('https://edge.example', {
        headers: { Authorization: 'Basic token-value' },
      }),
    ),
    '',
  );
});

Deno.test('문자열 입력은 공백을 정리하고 글자 수 제한을 지킨다', () => {
  assertEqual(text('  축하합니다  ', 10), '축하합니다');

  let rejected = false;
  try {
    text('너무 길어요', 2);
  } catch {
    rejected = true;
  }
  assertEqual(rejected, true);
});

Deno.test('예상 가능한 오류는 안정적인 코드와 상태로 반환한다', async () => {
  const { respondError } = createHttpHelpers(new Set());
  const response = respondError(
    new HttpError(
      409,
      'CONTENT_CONFLICT',
      '현재 상태에서는 처리할 수 없습니다.',
    ),
  );
  const body = await response.json();

  assertEqual(response.status, 409);
  assertEqual(body.code, 'CONTENT_CONFLICT');
  assertEqual(body.error, '현재 상태에서는 처리할 수 없습니다.');
});

Deno.test(
  '예상하지 못한 오류의 내부 메시지는 응답에 노출하지 않는다',
  async () => {
    const { respondError } = createHttpHelpers(new Set());
    const response = respondError(new Error('private database detail'));
    const body = await response.json();

    assertEqual(response.status, 500);
    assertEqual(body.code, 'INTERNAL_SERVER_ERROR');
    assertEqual(body.error.includes('private database detail'), false);
    assertEqual(typeof body.requestId, 'string');
  },
);

Deno.test('잘못된 문자열 입력은 400 오류로 구분한다', () => {
  let error: unknown;
  try {
    text('너무 길어요', 2);
  } catch (caught) {
    error = caught;
  }

  if (!(error instanceof HttpError)) {
    throw new Error('Expected HttpError');
  }
  assertEqual(error.status, 400);
  assertEqual(error.code, 'INVALID_INPUT');
});
