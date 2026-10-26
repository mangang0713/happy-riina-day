/**
 * Hono Worker 학습용 API입니다. 운영 커뮤니티 API와 분리해 Supabase 로그인 검증만 시험합니다.
 */

import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';

/** Worker에 전달하는 공개 Supabase 연결 설정입니다. 서비스 역할 키는 받지 않습니다. */
type Bindings = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/** 배포 설정이나 로그인 없이 Worker가 요청에 응답하는지 확인합니다. */
app.get('/health', (context) =>
  context.json({ ok: true, service: 'happy-riina-api-lab' }),
);

/** Supabase Auth에 토큰을 검증하고 개인정보 없이 사용자 ID만 반환합니다. */
app.get('/api/me', async (context) => {
  const authorization = context.req.header('Authorization') ?? '';
  const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];

  if (!token) {
    return context.json(
      { code: 'UNAUTHORIZED', error: '로그인이 필요합니다.' },
      401,
    );
  }

  const supabaseUrl = context.env.SUPABASE_URL?.trim();
  const publishableKey = context.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !publishableKey) {
    return context.json(
      {
        code: 'SERVER_CONFIGURATION_MISSING',
        error: '학습 API의 Supabase 연결 설정이 필요합니다.',
      },
      503,
    );
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      const status = (error as { status?: number } | null)?.status;
      if (status && status >= 400 && status < 500) {
        return context.json(
          {
            code: 'INVALID_SESSION',
            error: '로그인 세션이 유효하지 않습니다.',
          },
          401,
        );
      }

      // 인증 서버의 응답 본문이나 토큰은 로그에 남기지 않습니다.
      console.error('Supabase Auth verification failed', {
        status: status ?? 'unknown',
      });
      return context.json(
        {
          code: 'AUTH_UPSTREAM_ERROR',
          error: '로그인 확인 서버에 연결하지 못했습니다.',
        },
        502,
      );
    }

    context.header('Cache-Control', 'no-store');
    return context.json({ user: { id: data.user.id } });
  } catch {
    // 예외에 요청 헤더가 포함될 수 있으므로 민감한 원문은 출력하지 않습니다.
    console.error('Supabase Auth request failed');
    return context.json(
      {
        code: 'AUTH_UPSTREAM_ERROR',
        error: '로그인 확인 서버에 연결하지 못했습니다.',
      },
      502,
    );
  }
});

/** 등록되지 않은 경로는 같은 JSON 형식으로 응답합니다. */
app.notFound((context) =>
  context.json({ code: 'NOT_FOUND', error: '요청한 경로가 없습니다.' }, 404),
);

/** 예기치 않은 오류의 내부 내용을 방문자 응답에 노출하지 않습니다. */
app.onError((error, context) => {
  console.error('Community API lab request failed', { name: error.name });
  return context.json(
    { code: 'INTERNAL_ERROR', error: '요청을 처리하지 못했습니다.' },
    500,
  );
});

export default app;
