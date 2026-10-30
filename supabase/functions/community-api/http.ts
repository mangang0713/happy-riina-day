/**
 * 이 모듈은 Edge Function 전반에서 공유하는 HTTP 헤더와 입력 도구를 제공합니다.
 */

/** 예상 가능한 API 오류를 상태 코드·안정적인 오류 코드와 함께 전달합니다. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 응답 생성기가 사용할 CORS·JSON 응답 함수를 허용 origin 설정에 묶습니다. */
export function createHttpHelpers(allowedOrigins: ReadonlySet<string>) {
  /** 브라우저가 허용된 로컬·배포 출처에서만 API 응답을 읽도록 CORS를 설정합니다. */
  function corsHeaders(origin: string | null) {
    const headers = new Headers({
      'Access-Control-Allow-Headers':
        'authorization, apikey, content-type, x-client-info, x-community-purge-secret',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    });
    if (origin && allowedOrigins.has(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
    }
    return headers;
  }

  /** 개인정보 응답을 캐시에 남기지 않고 JSON과 요청별 상태 코드로 반환합니다. */
  function respond(body: unknown, status = 200, origin: string | null = null) {
    const headers = corsHeaders(origin);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Cache-Control', 'no-store');
    return new Response(JSON.stringify(body), { status, headers });
  }

  /** 내부 예외 내용을 감추고 예상 가능한 오류와 서버 오류를 구분합니다. */
  function respondError(error: unknown, origin: string | null = null) {
    if (error instanceof HttpError) {
      return respond(
        { code: error.code, error: error.message },
        error.status,
        origin,
      );
    }

    const requestId = crypto.randomUUID();
    console.error('Unhandled community API error', {
      requestId,
      errorName: error instanceof Error ? error.name : 'NonErrorThrown',
    });
    return respond(
      {
        code: 'INTERNAL_SERVER_ERROR',
        error: '요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        requestId,
      },
      500,
      origin,
    );
  }

  return { corsHeaders, respond, respondError };
}

/** Authorization 헤더에서 Supabase 로그인 토큰만 꺼냅니다. */
export function getBearer(request: Request) {
  const value = request.headers.get('Authorization') ?? '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

/** 글과 사유 입력을 검증하고 서버 기준 길이 제한을 적용합니다. */
export function text(value: unknown, max: number) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_INPUT', '입력 내용이 올바르지 않습니다.');
  }
  const result = value.trim();
  if (result.length < 1 || result.length > max) {
    throw new HttpError(
      400,
      'INVALID_INPUT',
      '입력은 1~' + max + '자여야 합니다.',
    );
  }
  return result;
}
