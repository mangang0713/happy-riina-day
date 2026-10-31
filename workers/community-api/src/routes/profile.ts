import { Hono, type Context } from 'hono';
import type { QueryResultRow } from 'pg';
import type { WorkerEnv, WorkerVariables } from '../env';

const COMMUNITY_TERMS_VERSION = '2026-10-21-v2';

type RouteVariables = WorkerVariables & { userId: string | null };
type RouteContext = Context<{
  Bindings: WorkerEnv;
  Variables: RouteVariables;
}>;

export type ProfileRouteServices = {
  /** Better Auth cookie를 검증하고 현재 사용자 ID만 반환합니다. */
  resolveUserId: (
    env: WorkerEnv,
    database: WorkerVariables['database'],
    headers: Headers,
  ) => Promise<string | null>;
};

class ProfileRouteError extends Error {
  constructor(
    readonly status: 400 | 401 | 404 | 429 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function respondError(context: RouteContext, error: unknown) {
  if (error instanceof ProfileRouteError) {
    return context.json(
      { code: error.code, error: error.message },
      error.status,
    );
  }
  return context.json(
    { code: 'DATABASE_UNAVAILABLE', error: '프로필을 처리하지 못했습니다.' },
    503,
  );
}

function requireUser(context: RouteContext) {
  const userId = context.get('userId');
  if (!userId) {
    throw new ProfileRouteError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  }
  return userId;
}

async function parseJson(context: RouteContext) {
  try {
    const value: unknown = await context.req.json();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // 잘못된 JSON과 객체가 아닌 본문을 같은 안전한 입력 오류로 돌려줍니다.
  }
  throw new ProfileRouteError(
    400,
    'INVALID_REQUEST',
    '요청 형식이 올바르지 않습니다.',
  );
}

async function consumeProfileRateLimit(
  database: WorkerVariables['database'],
  userId: string,
) {
  try {
    const { rows } = await database.query(
      `
        insert into community_rate_limits
          (user_id, action, window_start, request_count)
        values (
          $1,
          'update-profile',
          to_timestamp(floor(extract(epoch from clock_timestamp()) / 3600) * 3600),
          1
        )
        on conflict (user_id, action, window_start) do update
          set request_count = community_rate_limits.request_count + 1
          where community_rate_limits.request_count < 10
        returning request_count
      `,
      [userId],
    );
    if (!rows.length) {
      throw new ProfileRouteError(
        429,
        'RATE_LIMITED',
        '표시 이름 변경 요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.',
      );
    }
  } catch (error) {
    if (error instanceof ProfileRouteError) throw error;
    throw new ProfileRouteError(
      503,
      'DATABASE_UNAVAILABLE',
      '프로필을 처리하지 못했습니다.',
    );
  }
}

/** 프로필 경로는 본인 표시 이름과 현재 공개 안내 동의 상태만 보여 주고 수정합니다. */
export function createProfileRoutes(services: ProfileRouteServices) {
  const routes = new Hono<{
    Bindings: WorkerEnv;
    Variables: RouteVariables;
  }>();

  routes.use('*', async (context, next) => {
    if (!context.req.header('Cookie')) {
      context.set('userId', null);
      await next();
      return;
    }
    try {
      context.set(
        'userId',
        await services.resolveUserId(
          context.env,
          context.get('database'),
          context.req.raw.headers,
        ),
      );
    } catch {
      return context.json(
        {
          code: 'SERVICE_UNAVAILABLE',
          error: '인증 서비스를 사용할 수 없습니다.',
        },
        503,
      );
    }
    await next();
  });

  // 다른 사용자의 프로필을 탐색하는 API가 아니라 로그인한 본인의 설정 조회입니다.
  routes.get('/me/profile', async (context) => {
    try {
      const userId = requireUser(context);
      const { rows } = await context.get('database').query<
        QueryResultRow & {
          id: string;
          display_name: string;
          community_terms_accepted_at: string | null;
          community_terms_version: string | null;
        }
      >(
        `
          select id, display_name, community_terms_accepted_at,
                 community_terms_version
          from profiles
          where id = $1
          limit 1
        `,
        [userId],
      );
      if (!rows[0]) {
        throw new ProfileRouteError(
          404,
          'PROFILE_NOT_FOUND',
          '프로필을 찾을 수 없습니다.',
        );
      }
      return context.json(rows[0]);
    } catch (error) {
      return respondError(context, error);
    }
  });

  // 닉네임은 한글 등 Unicode 글자 수를 기준으로 제한하고 시간당 변경 횟수를 둡니다.
  routes.patch('/me/profile', async (context) => {
    try {
      const userId = requireUser(context);
      const body = await parseJson(context);
      const displayName =
        typeof body.displayName === 'string' ? body.displayName.trim() : '';
      const displayNameLength = [...displayName].length;
      if (!displayNameLength || displayNameLength > 40) {
        throw new ProfileRouteError(
          400,
          'INVALID_INPUT',
          '표시 이름은 1~40자로 입력해 주세요.',
        );
      }

      const database = context.get('database');
      await consumeProfileRateLimit(database, userId);
      const { rows } = await database.query<{
        id: string;
        display_name: string;
      }>(
        `
          update profiles
          set display_name = $2, updated_at = now()
          where id = $1
          returning id, display_name
        `,
        [userId, displayName],
      );
      if (!rows[0]) {
        throw new ProfileRouteError(
          404,
          'PROFILE_NOT_FOUND',
          '프로필을 찾을 수 없습니다.',
        );
      }
      return context.json(rows[0]);
    } catch (error) {
      return respondError(context, error);
    }
  });

  // 서버가 동의 버전을 결정해 클라이언트가 오래된 약관 버전을 위조하지 못하게 합니다.
  routes.post('/me/community-terms', async (context) => {
    try {
      const userId = requireUser(context);
      const { rows } = await context.get('database').query<{ id: string }>(
        `
          update profiles
          set community_terms_accepted_at = now(),
              community_terms_version = $2,
              updated_at = now()
          where id = $1
          returning id
        `,
        [userId, COMMUNITY_TERMS_VERSION],
      );
      if (!rows[0]) {
        throw new ProfileRouteError(
          404,
          'PROFILE_NOT_FOUND',
          '프로필을 찾을 수 없습니다.',
        );
      }
      return context.json({ accepted: true, version: COMMUNITY_TERMS_VERSION });
    } catch (error) {
      return respondError(context, error);
    }
  });

  return routes;
}
