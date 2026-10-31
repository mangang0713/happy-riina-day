import { Hono, type Context, type Next } from 'hono';
import type { Pool } from 'pg';
import { createAuth, resolveSessionUserId } from './auth';
import { createDatabase } from './database';
import type { WorkerEnv, WorkerVariables } from './env';
import { purgeExpiredCommunityContent } from './moderation';
import { createCommunityRoutes } from './routes/community';
import { createAdminSettingsRoutes } from './routes/admin-settings';
import { createModerationRoutes } from './routes/moderation';
import { createProfileRoutes } from './routes/profile';
import { verifyTurnstile, type TurnstileResult } from './turnstile';

type WorkerServices = {
  createDatabase: (env: WorkerEnv) => Pool;
  resolveUserId: (
    env: WorkerEnv,
    database: Pool,
    headers: Headers,
  ) => Promise<string | null>;
  verifyTurnstile: (
    env: WorkerEnv,
    token: string | undefined,
  ) => Promise<TurnstileResult>;
};

/** Worker 요청마다 DB pool 생명주기를 묶습니다. Hyperdrive가 원본 DB 연결을 재사용합니다. */
function withRequestDatabase(
  createPool: WorkerServices['createDatabase'],
): (
  c: Context<{ Bindings: WorkerEnv; Variables: WorkerVariables }>,
  next: Next,
) => Promise<void> {
  return async (c, next) => {
    const database = createPool(c.env);
    c.set('database', database);
    try {
      await next();
    } finally {
      await database.end();
    }
  };
}

/** API 경로를 조립합니다. 외부 경계 주입은 로컬에서 인증·봇 확인 실패를 안전하게 시험할 때 씁니다. */
export function createWorkerApp(overrides: Partial<WorkerServices> = {}) {
  const services: WorkerServices = {
    createDatabase,
    resolveUserId: resolveSessionUserId,
    verifyTurnstile,
    ...overrides,
  };
  const app = new Hono<{
    Bindings: WorkerEnv;
    Variables: WorkerVariables;
  }>();
  const attachDatabase = withRequestDatabase(services.createDatabase);

  // DB와 OAuth 설정을 호출하지 않는 경량 상태 확인 경로입니다.
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  // 실제 자격 증명이 모두 설정된 로그인 provider만 화면에 안내합니다.
  app.get('/api/v1/providers', (c) => {
    const providers = [
      c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET ? 'google' : null,
      c.env.TWITTER_CLIENT_ID && c.env.TWITTER_CLIENT_SECRET ? 'x' : null,
      c.env.KAKAO_CLIENT_ID && c.env.KAKAO_CLIENT_SECRET ? 'kakao' : null,
    ].filter((provider): provider is string => provider !== null);
    return c.json({ providers });
  });

  // Better Auth와 DB를 사용하는 경로만 요청 단위 연결을 준비합니다.
  app.use('/api/auth', attachDatabase);
  app.use('/api/auth/*', attachDatabase);
  app.use('/api/v1/me', attachDatabase);
  app.use('/api/v1/me/*', attachDatabase);
  app.use('/api/v1/guestbook', attachDatabase);
  app.use('/api/v1/guestbook/*', attachDatabase);
  app.use('/api/v1/schedules/*', attachDatabase);
  app.use('/api/v1/media', attachDatabase);
  app.use('/api/v1/media/*', attachDatabase);
  app.use('/api/v1/reports', attachDatabase);
  app.use('/api/v1/admin/*', attachDatabase);
  app.use('/api/v1/content/*', attachDatabase);

  // OAuth callback과 세션 관리는 Better Auth에 위임합니다.
  app.all('/api/auth', (c) =>
    createAuth(c.env, c.get('database')).handler(c.req.raw),
  );
  app.all('/api/auth/*', (c) =>
    createAuth(c.env, c.get('database')).handler(c.req.raw),
  );

  app.get('/api/v1/me', async (c) => {
    try {
      const userId = await services.resolveUserId(
        c.env,
        c.get('database'),
        c.req.raw.headers,
      );
      if (!userId) {
        return c.json(
          { code: 'UNAUTHORIZED', error: '로그인이 필요합니다.' },
          401,
        );
      }

      // provider token·이메일·인증 내부 정보는 응답에 포함하지 않고 사용자 ID만 전달합니다.
      return c.json({ user: { id: userId } });
    } catch {
      return c.json(
        {
          code: 'SERVICE_UNAVAILABLE',
          error: '인증 서비스를 사용할 수 없습니다.',
        },
        503,
      );
    }
  });

  // 프로필, 약관 동의, 게시물, 사진, 조정 기능을 업무별 라우터에 연결합니다.
  app.route(
    '/api/v1',
    createProfileRoutes({ resolveUserId: services.resolveUserId }),
  );
  app.route(
    '/api/v1',
    createCommunityRoutes({
      resolveUserId: services.resolveUserId,
      verifyTurnstile: services.verifyTurnstile,
    }),
  );
  app.route(
    '/api/v1',
    createModerationRoutes({
      resolveUserId: services.resolveUserId,
    }),
  );
  app.route(
    '/api/v1',
    createAdminSettingsRoutes({
      resolveUserId: services.resolveUserId,
    }),
  );

  // API 경로는 JSON 404를 반환하고 페이지 경로만 SPA 정적 파일로 보냅니다.
  app.notFound((c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.json(
        { code: 'NOT_FOUND', error: '요청한 API를 찾을 수 없습니다.' },
        404,
      );
    }
    return c.env.ASSETS.fetch(c.req.raw);
  });

  app.onError(
    () =>
      new Response(
        JSON.stringify({
          code: 'INTERNAL_ERROR',
          error: '요청을 처리하지 못했습니다.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        },
      ),
  );

  return app;
}

export const app = createWorkerApp();

/** 15분 주기 Cron 진입점입니다. 보존 기한이 지난 숨김 글·이의제기 안내만 제한적으로 정리합니다. */
export async function scheduled(
  _controller: ScheduledController,
  env: WorkerEnv,
) {
  const database = createDatabase(env);
  try {
    await purgeExpiredCommunityContent(database, env.MEDIA_BUCKET);
  } finally {
    await database.end();
  }
}

export default app;
