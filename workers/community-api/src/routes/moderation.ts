import { Hono, type Context } from 'hono';
import type { WorkerEnv, WorkerVariables } from '../env';
import {
  createContentReport,
  deleteOwnCommunityContent,
  decideReport,
  getMyContent,
  hideContent,
  listHiddenContent,
  listOpenReports,
  ModerationError,
  resolveAppeal,
  restoreContent,
  submitAppeal,
  type AppealDecision,
  type ModeratedContentType,
  type ReportDecision,
} from '../moderation';

/** 조정 요청 처리 동안 인증된 세션의 사용자 ID를 보관합니다. */
type RouteVariables = WorkerVariables & { userId: string | null };
type RouteContext = Context<{ Bindings: WorkerEnv; Variables: RouteVariables }>;

export type ModerationRouteServices = {
  /** Better Auth 세션을 확인하고 유효하면 계정 ID만 돌려줍니다. */
  resolveUserId: (
    env: WorkerEnv,
    database: WorkerVariables['database'],
    headers: Headers,
  ) => Promise<string | null>;
};

class RouteError extends Error {
  constructor(
    readonly status: 400 | 401,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function respondError(context: RouteContext, error: Error) {
  if (error instanceof ModerationError) {
    return context.json(
      { code: error.code, error: error.message },
      error.status,
    );
  }
  if (error instanceof RouteError) {
    return context.json(
      { code: error.code, error: error.message },
      error.status,
    );
  }
  return context.json(
    { code: 'INTERNAL_ERROR', error: '요청을 처리하지 못했습니다.' },
    500,
  );
}

async function parseBody(context: RouteContext) {
  try {
    const body: unknown = await context.req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid body');
    }
    return body as Record<string, unknown>;
  } catch {
    throw new RouteError(
      400,
      'INVALID_REQUEST',
      '요청 형식이 올바르지 않습니다.',
    );
  }
}

function contentType(value: unknown): ModeratedContentType {
  if (value === 'guestbook' || value === 'review') return value;
  throw new RouteError(
    400,
    'INVALID_CONTENT_TYPE',
    '게시물 종류가 올바르지 않습니다.',
  );
}

function uuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new RouteError(
      400,
      'INVALID_ID',
      '게시물 식별 정보가 올바르지 않습니다.',
    );
  }
  return value;
}

function requiredText(value: unknown, maxLength: number, label: string) {
  if (typeof value !== 'string') {
    throw new RouteError(400, 'INVALID_INPUT', `${label}을(를) 입력해 주세요.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new RouteError(
      400,
      'INVALID_INPUT',
      `${label}은(는) 1~${maxLength}자로 입력해 주세요.`,
    );
  }
  return trimmed;
}

function optionalText(value: unknown, maxLength: number, label: string) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new RouteError(
      400,
      'INVALID_INPUT',
      `${label}은(는) ${maxLength}자 이내로 입력해 주세요.`,
    );
  }
  return value.trim() || null;
}

function signedInUser(context: RouteContext) {
  const userId = context.get('userId');
  if (!userId) {
    throw new RouteError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  }
  return userId;
}

/** 신고·관리자 조치·이의제기 API를 게시물 CRUD와 분리해 권한 경계를 드러냅니다. */
export function createModerationRoutes(services: ModerationRouteServices) {
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

  // 본인 게시물의 숨김 상태와 이의제기 처리 결과만 제공합니다.
  routes.get('/me/content', async (context) => {
    try {
      return context.json(
        await getMyContent(context.get('database'), signedInUser(context)),
      );
    } catch (error) {
      return respondError(
        context,
        error instanceof Error ? error : new Error(),
      );
    }
  });

  // 로그인 사용자만 타인의 글을 신고할 수 있으며 신고 사유와 설명 길이를 제한합니다.
  routes.post('/reports', async (context) => {
    try {
      const userId = signedInUser(context);
      const body = await parseBody(context);
      const type = contentType(body.contentType);
      const id = uuid(String(body.contentId ?? ''));
      const reason = requiredText(body.reason, 80, '신고 사유');
      const details = optionalText(body.details, 500, '추가 설명');
      return context.json(
        await createContentReport(context.get('database'), userId, {
          contentType: type,
          contentId: id,
          reason,
          details,
        }),
        201,
      );
    } catch (error) {
      return respondError(
        context,
        error instanceof Error ? error : new Error(),
      );
    }
  });

  /** 작성자의 공개 글 삭제와 관리자의 숨김·이의제기 처리를 서로 다른 권한 경로로 유지합니다. */
  routes.delete('/content/:contentType/:contentId', async (context) => {
    try {
      await deleteOwnCommunityContent(
        context.get('database'),
        context.env.MEDIA_BUCKET,
        signedInUser(context),
        contentType(context.req.param('contentType')),
        uuid(context.req.param('contentId')),
      );
      return context.json({ deleted: true });
    } catch (error) {
      return respondError(
        context,
        error instanceof Error ? error : new Error(),
      );
    }
  });

  // 신고자 정보가 포함될 수 있는 미처리 신고 목록은 관리자에게만 제공합니다.
  routes.get('/admin/reports', async (context) => {
    try {
      return context.json(
        await listOpenReports(context.get('database'), signedInUser(context)),
      );
    } catch (error) {
      return respondError(
        context,
        error instanceof Error ? error : new Error(),
      );
    }
  });

  // 관리자 조정 대기열에서 숨김 글과 최근 이의제기 상태를 검토합니다.
  routes.get('/admin/hidden-content', async (context) => {
    try {
      return context.json(
        await listHiddenContent(context.get('database'), signedInUser(context)),
      );
    } catch (error) {
      return respondError(
        context,
        error instanceof Error ? error : new Error(),
      );
    }
  });

  // 신고를 기각하거나 숨김 조치로 연결하고, 숨김 시 작성자에게 사유를 남깁니다.
  routes.post('/admin/reports/:reportId/decision', async (context) => {
    try {
      const userId = signedInUser(context);
      const body = await parseBody(context);
      const decision = body.decision;
      if (decision !== 'dismiss' && decision !== 'hide') {
        throw new RouteError(
          400,
          'INVALID_DECISION',
          '신고 처리 방법이 올바르지 않습니다.',
        );
      }
      const reason =
        decision === 'hide'
          ? requiredText(body.reason, 1000, '숨김 사유')
          : null;
      return context.json(
        await decideReport(
          context.get('database'),
          userId,
          uuid(context.req.param('reportId')),
          decision as ReportDecision,
          reason,
        ),
      );
    } catch (error) {
      return respondError(
        context,
        error instanceof Error ? error : new Error(),
      );
    }
  });

  // 신고가 없어도 관리자가 사유를 기록하고 게시물을 직접 숨길 수 있습니다.
  routes.post(
    '/admin/content/:contentType/:contentId/hide',
    async (context) => {
      try {
        const userId = signedInUser(context);
        const body = await parseBody(context);
        const reason = requiredText(body.reason, 1000, '숨김 사유');
        return context.json(
          await hideContent(
            context.get('database'),
            userId,
            contentType(context.req.param('contentType')),
            uuid(context.req.param('contentId')),
            reason,
          ),
        );
      } catch (error) {
        return respondError(
          context,
          error instanceof Error ? error : new Error(),
        );
      }
    },
  );

  // 관리자의 복원은 공개 상태로 되돌리고 대기 중인 이의제기도 승인 처리합니다.
  routes.post(
    '/admin/content/:contentType/:contentId/restore',
    async (context) => {
      try {
        return context.json(
          await restoreContent(
            context.get('database'),
            signedInUser(context),
            contentType(context.req.param('contentType')),
            uuid(context.req.param('contentId')),
          ),
        );
      } catch (error) {
        return respondError(
          context,
          error instanceof Error ? error : new Error(),
        );
      }
    },
  );

  // 작성자는 보존 기한 안에 숨김 결정에 한 번 이의를 신청합니다.
  routes.post('/content/:contentType/:contentId/appeals', async (context) => {
    try {
      const userId = signedInUser(context);
      const body = await parseBody(context);
      const reason = requiredText(body.reason, 1000, '이의제기 내용');
      return context.json(
        await submitAppeal(
          context.get('database'),
          userId,
          contentType(context.req.param('contentType')),
          uuid(context.req.param('contentId')),
          reason,
        ),
        201,
      );
    } catch (error) {
      return respondError(
        context,
        error instanceof Error ? error : new Error(),
      );
    }
  });

  // 승인 시 자동 복원하고 기각 시 본문·사진을 정리하며 사유만 7일 보존합니다.
  routes.post('/admin/appeals/:appealId/decision', async (context) => {
    try {
      const userId = signedInUser(context);
      const body = await parseBody(context);
      const decision = body.decision;
      if (decision !== 'approve' && decision !== 'reject') {
        throw new RouteError(
          400,
          'INVALID_DECISION',
          '이의제기 처리 방법이 올바르지 않습니다.',
        );
      }
      const reason =
        decision === 'reject'
          ? requiredText(body.reason, 1000, '기각 사유')
          : optionalText(body.reason, 1000, '처리 사유');
      return context.json(
        await resolveAppeal(
          context.get('database'),
          context.env.MEDIA_BUCKET,
          userId,
          uuid(context.req.param('appealId')),
          decision as AppealDecision,
          reason,
        ),
      );
    } catch (error) {
      return respondError(
        context,
        error instanceof Error ? error : new Error(),
      );
    }
  });

  return routes;
}
