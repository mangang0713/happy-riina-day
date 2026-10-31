import { Hono, type Context } from 'hono';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { TurnstileResult } from '../turnstile';
import type { WorkerEnv, WorkerVariables } from '../env';
import {
  cleanExpiredMediaUploads,
  deleteCommunityMedia,
  detectImageContentType,
  finalizeMediaUpload,
  MAX_MEDIA_FILE_BYTES,
  MediaError,
  releaseMediaUpload,
  reserveMediaUpload,
  type ImageContentType,
  type MediaParentType,
} from '../media';

/** 공개 커뮤니티와 사용자 작성 기능의 HTTP 계약을 묶습니다. */
type CommunityVariables = {
  userId: string | null;
};

const COMMUNITY_TERMS_VERSION = '2026-10-21-v2';
const MAX_DATABASE_BYTES = 400 * 1024 * 1024;
const POST_BODY_MAX_LENGTH = 1200;

/** 요청에서 로그인 사용자와 Turnstile 검증기를 가져오는 라우터 의존성입니다. */
export type CommunityRouteServices = {
  resolveUserId: (
    env: WorkerEnv,
    database: WorkerVariables['database'],
    headers: Headers,
  ) => Promise<string | null>;
  verifyTurnstile: (
    env: WorkerEnv,
    token: string | undefined,
  ) => Promise<TurnstileResult>;
};

type CommunityContext = Context<{
  Bindings: WorkerEnv;
  Variables: CommunityVariables & WorkerVariables;
}>;

/** 커뮤니티 API가 클라이언트에 반환할 상태·코드·안내 문구를 함께 담습니다. */
class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function respondError(c: CommunityContext, error: ApiError) {
  return c.json({ code: error.code, error: error.message }, error.status);
}

function parseBodyText(value: unknown) {
  if (typeof value !== 'string') return null;
  const body = value.trim();
  if (body.length < 2 || body.length > POST_BODY_MAX_LENGTH) return null;
  return body;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function queryDatabase<T extends QueryResultRow>(
  database: WorkerVariables['database'],
  sql: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  try {
    return await database.query<T>(sql, values as never[] | undefined);
  } catch {
    throw new ApiError(
      503,
      'DATABASE_UNAVAILABLE',
      '커뮤니티 데이터베이스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
}

async function queryClient<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  try {
    return await client.query<T>(sql, values as never[] | undefined);
  } catch {
    throw new ApiError(
      503,
      'DATABASE_UNAVAILABLE',
      '커뮤니티 데이터베이스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
}

async function inTransaction<T>(
  database: WorkerVariables['database'],
  operation: (client: PoolClient) => Promise<T>,
) {
  let client: PoolClient;
  try {
    client = await database.connect();
  } catch {
    throw new ApiError(
      503,
      'DATABASE_UNAVAILABLE',
      '커뮤니티 데이터베이스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  }

  try {
    await queryClient(client, 'begin');
    const result = await operation(client);
    await queryClient(client, 'commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function createCommunityRoutes(services: CommunityRouteServices) {
  const community = new Hono<{
    Bindings: WorkerEnv;
    Variables: CommunityVariables & WorkerVariables;
  }>();

  // 공개 읽기는 익명으로 허용하되 세션이 있으면 본인·신고자별 응답을 만들기 위해 확인합니다.
  community.use('*', async (c, next) => {
    const cookie = c.req.header('Cookie');
    if (!cookie) {
      c.set('userId', null);
      await next();
      return;
    }

    try {
      c.set(
        'userId',
        await services.resolveUserId(
          c.env,
          c.get('database'),
          c.req.raw.headers,
        ),
      );
    } catch {
      return c.json(
        {
          code: 'SERVICE_UNAVAILABLE',
          error: '커뮤니티 서비스를 준비 중입니다.',
        },
        503,
      );
    }
    await next();
  });

  async function requireCommunityUser(c: CommunityContext) {
    const userId = c.get('userId');
    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
    }
    return userId;
  }

  async function parseRequestBody(c: CommunityContext) {
    try {
      const body: unknown = await c.req.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ApiError(
          400,
          'INVALID_REQUEST',
          '요청 형식이 올바르지 않습니다.',
        );
      }
      return body as Record<string, unknown>;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        400,
        'INVALID_REQUEST',
        '요청 형식이 올바르지 않습니다.',
      );
    }
  }

  async function verifyWriteRequest(c: CommunityContext, token: unknown) {
    const result = await services.verifyTurnstile(
      c.env,
      typeof token === 'string' ? token : undefined,
    );
    if (result === 'verified') return;
    if (result === 'unavailable') {
      throw new ApiError(
        503,
        'BOT_CHECK_UNAVAILABLE',
        '봇 확인 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
    throw new ApiError(
      403,
      'BOT_CHECK_FAILED',
      '봇 확인에 실패했습니다. 다시 시도해 주세요.',
    );
  }

  /** 모든 사용자 쓰기 전에 원격 중단 스위치와 DB 보호 상한을 확인합니다. */
  async function assertCommunityWritable(
    database: WorkerVariables['database'],
  ) {
    const { rows } = await queryDatabase<{
      community_enabled: boolean;
      database_bytes: string;
    }>(
      database,
      `
      select settings.community_enabled,
             pg_database_size(current_database())::text as database_bytes
      from community_settings as settings
      where settings.id = true
      limit 1
    `,
    );
    const settings = rows[0];
    if (!settings || !settings.community_enabled) {
      throw new ApiError(
        503,
        'COMMUNITY_DISABLED',
        '현재 커뮤니티 글쓰기를 사용할 수 없습니다.',
      );
    }
    if (Number(settings.database_bytes) >= MAX_DATABASE_BYTES) {
      throw new ApiError(
        503,
        'DATABASE_LIMIT_REACHED',
        '저장 공간 한도에 도달해 글쓰기를 잠시 중단했습니다.',
      );
    }
  }

  async function requireCurrentTerms(
    database: WorkerVariables['database'],
    userId: string,
  ) {
    const { rows } = await queryDatabase<{
      community_terms_version: string | null;
    }>(
      database,
      'select community_terms_version from profiles where id = $1 limit 1',
      [userId],
    );
    if (rows[0]?.community_terms_version !== COMMUNITY_TERMS_VERSION) {
      throw new ApiError(
        403,
        'COMMUNITY_TERMS_REQUIRED',
        '게시물 공개 안내를 확인하고 동의해 주세요.',
      );
    }
  }

  async function consumeRateLimit(
    database: WorkerVariables['database'],
    userId: string,
    action: string,
    limit: number,
  ) {
    const { rows } = await queryDatabase<{ request_count: number }>(
      database,
      `
      insert into community_rate_limits (user_id, action, window_start, request_count)
      values (
        $1,
        $2,
        to_timestamp(floor(extract(epoch from clock_timestamp()) / 3600) * 3600),
        1
      )
      on conflict (user_id, action, window_start) do update
        set request_count = community_rate_limits.request_count + 1
        where community_rate_limits.request_count < $3
      returning request_count
    `,
      [userId, action, limit],
    );
    if (!rows.length) {
      throw new ApiError(
        429,
        'RATE_LIMITED',
        '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  }

  async function getAuthorName(
    database: WorkerVariables['database'],
    userId: string,
  ) {
    const { rows } = await queryDatabase<{ display_name: string }>(
      database,
      'select display_name from profiles where id = $1 limit 1',
      [userId],
    );
    if (!rows[0]) {
      throw new ApiError(
        409,
        'PROFILE_REQUIRED',
        '표시 이름을 설정한 뒤 다시 시도해 주세요.',
      );
    }
    return rows[0].display_name;
  }

  /** 공개 읽기에서 한 번에 가져올 행 수를 제한해 무제한 조회를 막습니다. */
  function getPage(
    pageValue: string | undefined,
    limitValue: string | undefined,
  ) {
    const requestedPage = Number(pageValue ?? 0);
    const page = Number.isSafeInteger(requestedPage)
      ? Math.min(100_000, Math.max(0, requestedPage))
      : 0;
    const requestedLimit = Number(limitValue ?? 12);
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(12, Math.max(1, requestedLimit))
      : 12;
    return { limit, offset: page * limit };
  }

  // 방명록 작성은 로그인·Turnstile·현행 약관·운영 스위치·횟수 제한을 모두 통과해야 합니다.
  community.post('/guestbook', async (c) => {
    try {
      const userId = await requireCommunityUser(c);
      const body = await parseRequestBody(c);
      await verifyWriteRequest(c, body.turnstileToken);
      const database = c.get('database');

      await assertCommunityWritable(database);
      await requireCurrentTerms(database, userId);
      await consumeRateLimit(database, userId, 'create-guestbook', 10);

      const postBody = parseBodyText(body.body);
      if (!postBody) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '방명록은 2~1200자로 작성해 주세요.',
        );
      }
      const authorName = await getAuthorName(database, userId);
      const { rows } = await queryDatabase<{ id: string }>(
        database,
        `
        insert into guestbook_posts (user_id, author_name, body)
        values ($1, $2, $3)
        returning id
      `,
        [userId, authorName, postBody],
      );
      if (!rows[0]) throw new Error('Guestbook insert returned no row.');

      return c.json({ id: rows[0].id }, 201);
    } catch (error) {
      if (error instanceof ApiError) return respondError(c, error);
      return c.json(
        {
          code: 'INTERNAL_ERROR',
          error: '요청을 처리하지 못했습니다.',
        },
        500,
      );
    }
  });

  // 수정은 같은 작성자이면서 공개 상태인 글에만 허용합니다.
  community.put('/guestbook/:postId', async (c) => {
    try {
      const userId = await requireCommunityUser(c);
      const body = await parseRequestBody(c);
      await verifyWriteRequest(c, body.turnstileToken);
      const database = c.get('database');

      await assertCommunityWritable(database);
      await requireCurrentTerms(database, userId);
      await consumeRateLimit(database, userId, 'edit-guestbook', 8);

      const postId = c.req.param('postId');
      const postBody = parseBodyText(body.body);
      if (!isUuid(postId) || !postBody) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '게시물 또는 방명록 내용이 올바르지 않습니다.',
        );
      }
      const { rows } = await queryDatabase<{ id: string }>(
        database,
        `
        update guestbook_posts
        set body = $3, updated_at = now()
        where id = $1 and user_id = $2 and status = 'published'
        returning id
      `,
        [postId, userId, postBody],
      );
      if (!rows[0]) {
        throw new ApiError(
          403,
          'CONTENT_NOT_EDITABLE',
          '본인의 공개 상태 게시물만 수정할 수 있습니다.',
        );
      }

      return c.json({ id: rows[0].id });
    } catch (error) {
      if (error instanceof ApiError) return respondError(c, error);
      return c.json(
        {
          code: 'INTERNAL_ERROR',
          error: '요청을 처리하지 못했습니다.',
        },
        500,
      );
    }
  });

  // 공개 목록은 페이지 크기를 제한하고, 신고자는 자신이 신고한 글을 보지 않습니다.
  // 배열과 signed_url 필드는 기존 방명록 화면 계약에 맞추며, URL 요청 때도 서버가 접근 권한을 재검사합니다.
  community.get('/guestbook', async (c) => {
    try {
      const { limit, offset } = getPage(
        c.req.query('page'),
        c.req.query('limit'),
      );
      const userId = c.get('userId');
      const { rows } = await c.get('database').query(
        `
        select
          post.id,
          coalesce(nullif(btrim(profile.display_name), ''), post.author_name) as author_name,
          post.body,
          post.created_at,
          coalesce(post.user_id = $3, false) as is_mine,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', media.id,
                'content_type', media.content_type,
                'byte_size', media.byte_size,
                'signed_url', '/api/v1/media/' || media.id::text
              )
            ) filter (where media.id is not null),
            '[]'::jsonb
          ) as media
        from guestbook_posts as post
        left join profiles as profile on profile.id = post.user_id
        left join community_media as media on media.guestbook_post_id = post.id
        where post.status = 'published'
          and not exists (
            select 1
            from content_reports as report
            where report.reporter_id = $3
              and report.content_type = 'guestbook'
              and report.content_id = post.id
          )
        group by post.id, profile.display_name
        order by post.created_at desc
        offset $1
        limit $2
      `,
        [offset, limit, userId],
      );
      return c.json(rows);
    } catch {
      return c.json(
        {
          code: 'DATABASE_UNAVAILABLE',
          error: '방명록을 불러오지 못했습니다.',
        },
        503,
      );
    }
  });

  // 일정별 공개 후기를 배열로 반환해 기존 화면의 페이징 흐름을 유지합니다.
  // 사진 URL은 서명 토큰 대신 보호된 Worker 경로이며, 요청 때마다 게시물 권한을 재검사합니다.
  community.get('/schedules/:scheduleId/reviews', async (c) => {
    try {
      const { limit, offset } = getPage(
        c.req.query('page'),
        c.req.query('limit'),
      );
      const userId = c.get('userId');
      const { rows } = await c.get('database').query(
        `
        select
          review.id,
          review.schedule_id,
          coalesce(nullif(btrim(profile.display_name), ''), review.author_name) as author_name,
          review.body,
          review.rating,
          review.created_at,
          coalesce(review.user_id = $4, false) as is_mine,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', media.id,
                'content_type', media.content_type,
                'byte_size', media.byte_size,
                'signed_url', '/api/v1/media/' || media.id::text
              )
            ) filter (where media.id is not null),
            '[]'::jsonb
          ) as media
        from schedule_reviews as review
        left join profiles as profile on profile.id = review.user_id
        left join community_media as media on media.schedule_review_id = review.id
        where review.status = 'published'
          and review.schedule_id = $1
          and not exists (
            select 1
            from content_reports as report
            where report.reporter_id = $4
              and report.content_type = 'review'
              and report.content_id = review.id
          )
        group by review.id, profile.display_name
        order by review.created_at desc
        offset $2
        limit $3
      `,
        [c.req.param('scheduleId'), offset, limit, userId],
      );
      return c.json(rows);
    } catch {
      return c.json(
        { code: 'DATABASE_UNAVAILABLE', error: '후기를 불러오지 못했습니다.' },
        503,
      );
    }
  });

  // 지도·행사 상세가 필요한 공개 좋아요 수와 현재 사용자의 상태만 제공합니다.
  community.get('/schedules/:scheduleId/reactions', async (c) => {
    try {
      const scheduleId = c.req.param('scheduleId').trim();
      if (!scheduleId || scheduleId.length > 100) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '일정 정보가 올바르지 않습니다.',
        );
      }
      const userId = c.get('userId');
      const { rows } = await queryDatabase<{
        like_count: string;
        liked: boolean;
        own_review_id: string | null;
      }>(
        c.get('database'),
        `
          select
            (select count(*)::text from schedule_likes where schedule_id = $1) as like_count,
            exists (
              select 1 from schedule_likes
              where schedule_id = $1 and user_id = $2
            ) as liked,
            (
              select id from schedule_reviews
              where schedule_id = $1 and user_id = $2
              limit 1
            ) as own_review_id
        `,
        [scheduleId, userId],
      );
      const stats = rows[0];
      if (!stats) {
        throw new ApiError(
          503,
          'DATABASE_UNAVAILABLE',
          '일정 반응을 불러오지 못했습니다.',
        );
      }
      return c.json({
        like_count: Number(stats.like_count),
        liked: stats.liked,
        own_review_id: stats.own_review_id,
      });
    } catch (error) {
      if (error instanceof ApiError) return respondError(c, error);
      return c.json(
        { code: 'INTERNAL_ERROR', error: '일정 반응을 불러오지 못했습니다.' },
        500,
      );
    }
  });

  // 작성 중인 폼 복원용으로 현재 사용자의 공개 후기만 반환합니다.
  community.get('/schedules/:scheduleId/reviews/own', async (c) => {
    try {
      const userId = await requireCommunityUser(c);
      const scheduleId = c.req.param('scheduleId').trim();
      if (!scheduleId || scheduleId.length > 100) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '일정 정보가 올바르지 않습니다.',
        );
      }
      const { rows } = await queryDatabase<{
        id: string;
        schedule_id: string;
        author_name: string;
        body: string;
        rating: number;
        created_at: string;
        media: unknown[];
      }>(
        c.get('database'),
        `
          select
            review.id,
            review.schedule_id,
            coalesce(nullif(btrim(profile.display_name), ''), review.author_name) as author_name,
            review.body,
            review.rating,
            review.created_at,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', media.id,
                  'content_type', media.content_type,
                  'byte_size', media.byte_size,
                  'url', '/api/v1/media/' || media.id::text
                )
              ) filter (where media.id is not null),
              '[]'::jsonb
            ) as media
          from schedule_reviews as review
          left join profiles as profile on profile.id = review.user_id
          left join community_media as media on media.schedule_review_id = review.id
          where review.schedule_id = $1
            and review.user_id = $2
            and review.status = 'published'
          group by review.id, profile.display_name
          limit 1
        `,
        [scheduleId, userId],
      );
      return c.json(rows[0] ?? null);
    } catch (error) {
      if (error instanceof ApiError) return respondError(c, error);
      return c.json(
        { code: 'INTERNAL_ERROR', error: '내 후기를 불러오지 못했습니다.' },
        500,
      );
    }
  });

  // 일정당 사용자 후기 하나만 허용하며 중복은 DB 제약으로도 막습니다.
  community.post('/schedules/:scheduleId/reviews', async (c) => {
    try {
      const userId = await requireCommunityUser(c);
      const body = await parseRequestBody(c);
      await verifyWriteRequest(c, body.turnstileToken);
      const database = c.get('database');
      const scheduleId = c.req.param('scheduleId').trim();
      const reviewBody = parseBodyText(body.body);
      const rating = Number(body.rating);

      if (!scheduleId || scheduleId.length > 100 || !reviewBody) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '일정과 후기를 확인하고 후기는 2~1200자로 작성해 주세요.',
        );
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '별점은 1~5점으로 선택해 주세요.',
        );
      }

      await assertCommunityWritable(database);
      await requireCurrentTerms(database, userId);
      await consumeRateLimit(database, userId, 'save-review', 5);
      const authorName = await getAuthorName(database, userId);
      const { rows } = await queryDatabase<{ id: string }>(
        database,
        `
          insert into schedule_reviews
            (schedule_id, user_id, author_name, body, rating)
          values ($1, $2, $3, $4, $5)
          on conflict (schedule_id, user_id) where user_id is not null
          do nothing
          returning id
        `,
        [scheduleId, userId, authorName, reviewBody, rating],
      );
      if (!rows[0]) {
        throw new ApiError(
          409,
          'REVIEW_ALREADY_EXISTS',
          '일정당 후기는 하나만 작성할 수 있습니다. 기존 후기를 수정해 주세요.',
        );
      }

      return c.json({ id: rows[0].id }, 201);
    } catch (error) {
      if (error instanceof ApiError) return respondError(c, error);
      return c.json(
        { code: 'INTERNAL_ERROR', error: '요청을 처리하지 못했습니다.' },
        500,
      );
    }
  });

  // 수정 요청에서도 일정·작성자·공개 상태를 다시 검사합니다.
  community.put('/schedules/:scheduleId/reviews/:reviewId', async (c) => {
    try {
      const userId = await requireCommunityUser(c);
      const body = await parseRequestBody(c);
      await verifyWriteRequest(c, body.turnstileToken);
      const database = c.get('database');
      const scheduleId = c.req.param('scheduleId').trim();
      const reviewId = c.req.param('reviewId');
      const reviewBody = parseBodyText(body.body);
      const rating = Number(body.rating);

      if (
        !scheduleId ||
        scheduleId.length > 100 ||
        !isUuid(reviewId) ||
        !reviewBody
      ) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '일정, 후기 또는 후기 내용이 올바르지 않습니다.',
        );
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '별점은 1~5점으로 선택해 주세요.',
        );
      }

      await assertCommunityWritable(database);
      await requireCurrentTerms(database, userId);
      await consumeRateLimit(database, userId, 'save-review', 5);
      const { rows } = await queryDatabase<{ id: string }>(
        database,
        `
          update schedule_reviews
          set body = $4, rating = $5, updated_at = now()
          where id = $1 and schedule_id = $2 and user_id = $3
            and status = 'published'
          returning id
        `,
        [reviewId, scheduleId, userId, reviewBody, rating],
      );
      if (!rows[0]) {
        throw new ApiError(
          403,
          'CONTENT_NOT_EDITABLE',
          '본인의 공개 상태 후기만 수정할 수 있습니다.',
        );
      }

      return c.json({ id: rows[0].id });
    } catch (error) {
      if (error instanceof ApiError) return respondError(c, error);
      return c.json(
        { code: 'INTERNAL_ERROR', error: '요청을 처리하지 못했습니다.' },
        500,
      );
    }
  });

  // 동일 사용자의 연속 토글이 서로 덮어쓰지 않도록 트랜잭션 잠금 아래 상태를 전환합니다.
  community.post('/schedules/:scheduleId/like', async (c) => {
    try {
      const userId = await requireCommunityUser(c);
      const scheduleId = c.req.param('scheduleId').trim();
      if (!scheduleId || scheduleId.length > 100) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '일정 정보가 올바르지 않습니다.',
        );
      }
      const database = c.get('database');
      await assertCommunityWritable(database);
      await consumeRateLimit(database, userId, 'toggle-like', 30);

      const liked = await inTransaction(database, async (client) => {
        // 같은 계정·일정의 동시 토글을 직렬화해 좋아요 상태가 어긋나지 않게 합니다.
        await queryClient(
          client,
          'select pg_advisory_xact_lock(hashtextextended($1, 0))',
          [`${scheduleId}:${userId}`],
        );
        const { rows: removed } = await queryClient<{ id: string }>(
          client,
          'delete from schedule_likes where schedule_id = $1 and user_id = $2 returning id',
          [scheduleId, userId],
        );
        if (removed.length) return false;

        const { rows: inserted } = await queryClient<{ id: string }>(
          client,
          `
            insert into schedule_likes (schedule_id, user_id)
            values ($1, $2)
            on conflict (schedule_id, user_id) do nothing
            returning id
          `,
          [scheduleId, userId],
        );
        if (inserted.length) return true;

        const { rows: existing } = await queryClient<{ id: string }>(
          client,
          'select id from schedule_likes where schedule_id = $1 and user_id = $2 limit 1',
          [scheduleId, userId],
        );
        return existing.length > 0;
      });

      return c.json({ liked });
    } catch (error) {
      if (error instanceof ApiError) return respondError(c, error);
      return c.json(
        { code: 'INTERNAL_ERROR', error: '요청을 처리하지 못했습니다.' },
        500,
      );
    }
  });

  // 사진은 DB에서 할당량을 먼저 예약한 뒤 비공개 R2에 저장하고 성공 시 메타데이터를 확정합니다.
  community.post('/media', async (c) => {
    let reservationId: string | null = null;
    let objectPath: string | null = null;
    let objectStored = false;
    try {
      const userId = await requireCommunityUser(c);
      const contentLength = Number(c.req.header('Content-Length'));
      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_MEDIA_FILE_BYTES + 128 * 1024
      ) {
        throw new MediaError(
          413,
          'FILE_TOO_LARGE',
          '사진 요청 크기가 너무 큽니다. 1MB 이하 사진을 올려 주세요.',
        );
      }

      let form: FormData;
      try {
        form = await c.req.formData();
      } catch {
        throw new ApiError(
          400,
          'INVALID_REQUEST',
          '사진 업로드 형식이 올바르지 않습니다.',
        );
      }
      await verifyWriteRequest(c, form.get('turnstileToken'));
      const database = c.get('database');
      await assertCommunityWritable(database);
      await requireCurrentTerms(database, userId);
      await consumeRateLimit(database, userId, 'upload-image', 6);

      const parentType = form.get('parentType');
      const parentId = form.get('parentId');
      const file = form.get('file');
      if (
        (parentType !== 'guestbook' && parentType !== 'review') ||
        typeof parentId !== 'string' ||
        !isUuid(parentId) ||
        !(file instanceof File)
      ) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '사진을 연결할 게시물과 파일을 확인해 주세요.',
        );
      }
      if (file.size < 1) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '빈 파일은 업로드할 수 없습니다.',
        );
      }
      if (file.size > MAX_MEDIA_FILE_BYTES) {
        throw new MediaError(
          413,
          'FILE_TOO_LARGE',
          '사진은 장당 1MB 이하로 올려 주세요.',
        );
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new MediaError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'JPG, PNG, WebP 사진만 올릴 수 있습니다.',
        );
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const detectedType = detectImageContentType(bytes);
      if (detectedType !== file.type) {
        throw new MediaError(
          415,
          'INVALID_IMAGE_CONTENT',
          '파일 내용과 이미지 형식이 일치하지 않습니다.',
        );
      }

      const extension: Record<ImageContentType, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };
      const path = `community/${crypto.randomUUID()}.${extension[detectedType]}`;
      const typedParentType = parentType as MediaParentType;
      await cleanExpiredMediaUploads(database, c.env.MEDIA_BUCKET);
      reservationId = await reserveMediaUpload(database, {
        userId,
        parentType: typedParentType,
        parentId,
        objectPath: path,
        byteSize: file.size,
      });
      objectPath = path;

      try {
        await c.env.MEDIA_BUCKET.put(path, bytes, {
          httpMetadata: {
            contentType: detectedType,
            cacheControl: 'private, max-age=60',
          },
        });
        objectStored = true;
      } catch {
        throw new MediaError(
          503,
          'MEDIA_STORAGE_UNAVAILABLE',
          '사진 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
      }

      const mediaId = await finalizeMediaUpload(database, {
        reservationId,
        userId,
        parentType: typedParentType,
        parentId,
        objectPath: path,
        contentType: detectedType,
        byteSize: file.size,
      });
      reservationId = null;
      objectStored = false;
      return c.json({ mediaId }, 201);
    } catch (error) {
      if (reservationId) {
        if (objectStored && objectPath) {
          await c.env.MEDIA_BUCKET.delete(objectPath).catch(() => undefined);
        }
        await releaseMediaUpload(c.get('database'), reservationId).catch(
          () => undefined,
        );
      }
      if (error instanceof MediaError) {
        return c.json({ code: error.code, error: error.message }, error.status);
      }
      if (error instanceof ApiError) return respondError(c, error);
      return c.json(
        { code: 'INTERNAL_ERROR', error: '요청을 처리하지 못했습니다.' },
        500,
      );
    }
  });

  // 공개 글의 첨부 사진은 작성자 또는 관리자가 삭제할 수 있습니다.
  community.delete('/media/:mediaId', async (c) => {
    try {
      const userId = await requireCommunityUser(c);
      const mediaId = c.req.param('mediaId');
      if (!isUuid(mediaId)) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          '사진 정보가 올바르지 않습니다.',
        );
      }
      const database = c.get('database');
      await consumeRateLimit(database, userId, 'delete-media', 20);
      await deleteCommunityMedia(database, c.env.MEDIA_BUCKET, mediaId, userId);
      return c.json({ deleted: true });
    } catch (error) {
      if (error instanceof MediaError) {
        return c.json({ code: error.code, error: error.message }, error.status);
      }
      if (error instanceof ApiError) return respondError(c, error);
      return c.json(
        { code: 'INTERNAL_ERROR', error: '요청을 처리하지 못했습니다.' },
        500,
      );
    }
  });

  /** 비공개 R2 사진은 부모 글의 공개 상태와 요청자의 권한을 매번 확인한 뒤 전달합니다. */
  community.get('/media/:mediaId', async (c) => {
    try {
      const { rows } = await c.get('database').query<{
        object_path: string;
        content_type: string;
      }>(
        `
        select media.object_path, media.content_type
        from community_media as media
        left join guestbook_posts as post on post.id = media.guestbook_post_id
        left join schedule_reviews as review on review.id = media.schedule_review_id
        where media.id = $1
          and exists (
            select 1
            from community_settings as settings
            where settings.id = true
              and settings.community_enabled
              and settings.media_views_enabled
          )
          and (
            (
              post.status = 'published'
              and (
                exists (
                  select 1 from admin_members as admin
                  where admin.user_id = $2
                )
                or not exists (
                  select 1 from content_reports as report
                  where report.reporter_id = $2
                    and report.content_type = 'guestbook'
                    and report.content_id = post.id
                )
              )
            )
            or (
              review.status = 'published'
              and (
                exists (
                  select 1 from admin_members as admin
                  where admin.user_id = $2
                )
                or not exists (
                  select 1 from content_reports as report
                  where report.reporter_id = $2
                    and report.content_type = 'review'
                    and report.content_id = review.id
                )
              )
            )
            or (
              post.status in ('hidden', 'purging')
              and (post.user_id = $2 or exists (
                select 1 from admin_members as admin
                where admin.user_id = $2
              ))
            )
            or (
              review.status in ('hidden', 'purging')
              and (review.user_id = $2 or exists (
                select 1 from admin_members as admin
                where admin.user_id = $2
              ))
            )
          )
        limit 1
      `,
        [c.req.param('mediaId'), c.get('userId')],
      );

      const media = rows[0];
      if (!media) {
        return c.json(
          { code: 'NOT_FOUND', error: '사진을 찾을 수 없습니다.' },
          404,
        );
      }

      const object = await c.env.MEDIA_BUCKET.get(media.object_path);
      if (!object) {
        return c.json(
          { code: 'NOT_FOUND', error: '사진을 찾을 수 없습니다.' },
          404,
        );
      }

      return new Response(object.body, {
        headers: {
          'Content-Type': media.content_type,
          'Cache-Control': 'private, max-age=60',
          'X-Content-Type-Options': 'nosniff',
          ETag: object.httpEtag,
        },
      });
    } catch {
      return c.json(
        { code: 'MEDIA_UNAVAILABLE', error: '사진을 불러오지 못했습니다.' },
        503,
      );
    }
  });

  return community;
}
