import { Hono, type Context } from 'hono';
import type { PoolClient, QueryResultRow } from 'pg';
import type { WorkerEnv, WorkerVariables } from '../env';

/** 관리자가 확인·변경하는 중단 스위치와 저장소 사용량의 응답 형식입니다. */
type AdminSettingsRow = QueryResultRow & {
  community_enabled: boolean;
  uploads_enabled: boolean;
  media_views_enabled: boolean;
  storage_used_bytes: string;
  storage_limit_bytes: string;
  database_used_bytes: string;
};

type RouteVariables = WorkerVariables & { userId: string | null };
type RouteContext = Context<{ Bindings: WorkerEnv; Variables: RouteVariables }>;

export type AdminSettingsRouteServices = {
  /** Better Auth 세션을 검증하고 유효한 계정 ID만 반환합니다. */
  resolveUserId: (
    env: WorkerEnv,
    database: WorkerVariables['database'],
    headers: Headers,
  ) => Promise<string | null>;
};

/** 관리자 API가 반환할 수 있는 입력·인증·권한·DB 오류입니다. */
class AdminSettingsError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const PATCHABLE_SETTINGS = [
  'community_enabled',
  'uploads_enabled',
  'media_views_enabled',
] as const;

/** DB 쿼리 실패의 상세 정보를 감추고 같은 형태의 안전한 오류를 돌려줍니다. */
function respondError(context: RouteContext, error: unknown) {
  if (error instanceof AdminSettingsError) {
    return context.json(
      { code: error.code, error: error.message },
      error.status,
    );
  }
  return context.json(
    { code: 'DATABASE_UNAVAILABLE', error: '운영 설정을 처리하지 못했습니다.' },
    503,
  );
}

function requireUser(context: RouteContext) {
  const userId = context.get('userId');
  if (!userId) {
    throw new AdminSettingsError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  }
  return userId;
}

/** 관리자 권한은 수정 가능한 프로필이 아니라 서버가 관리하는 명단에서 확인합니다. */
async function requireAdmin(
  context: RouteContext,
  userId: string,
): Promise<void> {
  try {
    const { rows } = await context.get('database').query<{
      is_admin: boolean;
    }>('select exists(select 1 from admin_members where user_id = $1) as is_admin', [userId]);
    if (!rows[0]?.is_admin) {
      throw new AdminSettingsError(
        403,
        'ADMIN_REQUIRED',
        '관리자만 운영 설정을 볼 수 있습니다.',
      );
    }
  } catch (error) {
    if (error instanceof AdminSettingsError) throw error;
    throw new AdminSettingsError(
      503,
      'DATABASE_UNAVAILABLE',
      '관리자 권한을 확인하지 못했습니다.',
    );
  }
}

/** 관리자 화면에 실제 저장량과 운영 중단 기준을 전달합니다. */
async function readSettings(context: RouteContext) {
  try {
    const { rows } = await context.get('database').query<AdminSettingsRow>(`
      select community_enabled, uploads_enabled, media_views_enabled,
             storage_used_bytes::text, storage_limit_bytes::text,
             pg_database_size(current_database())::text as database_used_bytes
      from community_settings
      where id = true
      limit 1
    `);
    const settings = rows[0];
    if (!settings) throw new Error('Settings row is missing.');

    return {
      community_enabled: settings.community_enabled,
      uploads_enabled: settings.uploads_enabled,
      media_views_enabled: settings.media_views_enabled,
      storage_used_bytes: Number(settings.storage_used_bytes),
      storage_limit_bytes: Number(settings.storage_limit_bytes),
      database_used_bytes: Number(settings.database_used_bytes),
      database_warning_bytes: 350 * 1024 * 1024,
      database_stop_bytes: 400 * 1024 * 1024,
      // Worker는 계정 전체 전송량을 읽지 않습니다. 아래 값은 대시보드 참고 기준입니다.
      egress_warning_bytes: Math.round(3.5 * 1024 ** 3),
      egress_stop_bytes: 4 * 1024 ** 3,
    };
  } catch (error) {
    if (error instanceof AdminSettingsError) throw error;
    throw new AdminSettingsError(
      503,
      'DATABASE_UNAVAILABLE',
      '운영 설정을 불러오지 못했습니다.',
    );
  }
}

/** 설정 변경 본문에서 허용된 세 개의 boolean 스위치만 통과시킵니다. */
async function parseSettingsPatch(context: RouteContext) {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    throw new AdminSettingsError(
      400,
      'INVALID_REQUEST',
      '요청 형식이 올바르지 않습니다.',
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AdminSettingsError(
      400,
      'INVALID_REQUEST',
      '요청 형식이 올바르지 않습니다.',
    );
  }
  const settings = (body as Record<string, unknown>).settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new AdminSettingsError(
      400,
      'INVALID_SETTINGS',
      '변경할 운영 설정이 올바르지 않습니다.',
    );
  }

  const patch = settings as Record<string, unknown>;
  const keys = Object.keys(patch);
  if (
    !keys.length ||
    keys.some(
      (key) =>
        !PATCHABLE_SETTINGS.includes(
          key as (typeof PATCHABLE_SETTINGS)[number],
        ),
    ) ||
    Object.values(patch).some((value) => typeof value !== 'boolean')
  ) {
    throw new AdminSettingsError(
      400,
      'INVALID_SETTINGS',
      '세 가지 기능 중단 스위치만 true 또는 false로 변경할 수 있습니다.',
    );
  }
  return patch as Partial<Record<(typeof PATCHABLE_SETTINGS)[number], boolean>>;
}

/** 운영 설정 라우터입니다. 관리 권한을 확인한 뒤 세 가지 기능 스위치만 수정합니다. */
export function createAdminSettingsRoutes(
  services: AdminSettingsRouteServices,
) {
  const routes = new Hono<{
    Bindings: WorkerEnv;
    Variables: RouteVariables;
  }>();

  // 쿠키가 없으면 익명으로 처리하고, 쿠키가 있으면 Better Auth 세션을 검증합니다.
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

  routes.get('/admin/settings', async (context) => {
    try {
      const userId = requireUser(context);
      await requireAdmin(context, userId);
      return context.json(await readSettings(context));
    } catch (error) {
      return respondError(context, error);
    }
  });

  routes.patch('/admin/settings', async (context) => {
    try {
      const userId = requireUser(context);
      await requireAdmin(context, userId);
      const patch = await parseSettingsPatch(context);
      const database = context.get('database');
      let client: PoolClient;
      try {
        client = await database.connect();
      } catch {
        throw new AdminSettingsError(
          503,
          'DATABASE_UNAVAILABLE',
          '운영 설정을 저장하지 못했습니다.',
        );
      }

      try {
        await client.query('begin');
        const { rows } = await client.query<{ id: boolean }>(
          'select id from community_settings where id = true for update',
        );
        if (!rows[0]) {
          throw new AdminSettingsError(
            503,
            'SETTINGS_UNAVAILABLE',
            '운영 설정을 찾을 수 없습니다.',
          );
        }
        // 고정된 컬럼만 갱신하며 전역 설정 잠금으로 업로드 한도 변경과 경합을 막습니다.
        await client.query(
          `update community_settings
           set community_enabled = coalesce($1::boolean, community_enabled),
               uploads_enabled = coalesce($2::boolean, uploads_enabled),
               media_views_enabled = coalesce($3::boolean, media_views_enabled),
               updated_at = now()
           where id = true`,
          [
            patch.community_enabled ?? null,
            patch.uploads_enabled ?? null,
            patch.media_views_enabled ?? null,
          ],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        if (error instanceof AdminSettingsError) throw error;
        throw new AdminSettingsError(
          503,
          'DATABASE_UNAVAILABLE',
          '운영 설정을 저장하지 못했습니다.',
        );
      } finally {
        client.release();
      }
      return context.json({ saved: true });
    } catch (error) {
      return respondError(context, error);
    }
  });

  return routes;
}
