import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { WorkerVariables } from './env';

/** 신고·숨김·이의제기·만료 정리 정책을 DB 트랜잭션으로 처리합니다. */
/** 신고·숨김·이의제기 대상이 되는 사용자 콘텐츠 종류입니다. */
export type ModeratedContentType = 'guestbook' | 'review';
/** 신고를 닫거나 대상 콘텐츠를 숨기는 관리자 판정입니다. */
export type ReportDecision = 'dismiss' | 'hide';
/** 숨김 결정에 대한 작성자 이의제기의 관리자 판정입니다. */
export type AppealDecision = 'approve' | 'reject';

type Database = WorkerVariables['database'];

/** 조정 규칙에서 생긴 오류로, 라우터가 안정된 HTTP 상태·코드로 바꿉니다. */
export class ModerationError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 410 | 429 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function tableFor(contentType: ModeratedContentType) {
  return contentType === 'guestbook' ? 'guestbook_posts' : 'schedule_reviews';
}

function mediaParentColumn(contentType: ModeratedContentType) {
  return contentType === 'guestbook'
    ? 'guestbook_post_id'
    : 'schedule_review_id';
}

async function query<T extends QueryResultRow>(
  database: Database,
  sql: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  try {
    return await database.query<T>(sql, values as never[] | undefined);
  } catch {
    throw new ModerationError(
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
    throw new ModerationError(
      503,
      'DATABASE_UNAVAILABLE',
      '커뮤니티 데이터베이스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
}

async function transaction<T>(
  database: Database,
  operation: (client: PoolClient) => Promise<T>,
) {
  let client: PoolClient;
  try {
    client = await database.connect();
  } catch {
    throw new ModerationError(
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

async function takeRateLimit(
  database: Database,
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number,
) {
  const { rows } = await query<{ request_count: number }>(
    database,
    `
      insert into community_rate_limits
        (user_id, action, window_start, request_count)
      values (
        $1, $2,
        to_timestamp(floor(extract(epoch from clock_timestamp()) / $3) * $3),
        1
      )
      on conflict (user_id, action, window_start) do update
        set request_count = community_rate_limits.request_count + 1
        where community_rate_limits.request_count < $4
      returning request_count
    `,
    [userId, action, windowSeconds, limit],
  );
  if (!rows.length) {
    throw new ModerationError(
      429,
      'RATE_LIMITED',
      '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
}

async function requireAdmin(database: Database, userId: string) {
  const { rows } = await query<{ is_admin: boolean }>(
    database,
    'select exists(select 1 from admin_members where user_id = $1) as is_admin',
    [userId],
  );
  if (!rows[0]?.is_admin) {
    throw new ModerationError(
      403,
      'ADMIN_REQUIRED',
      '관리자만 이 작업을 할 수 있습니다.',
    );
  }
}

/**
 * Let authors immediately remove only published content they own. The settings
 * row serializes deletion with upload reservations; image objects and both quota
 * ledgers are removed before the content's moderation history is cleared.
 */
export async function deleteOwnCommunityContent(
  database: Database,
  bucket: R2Bucket,
  userId: string,
  contentType: ModeratedContentType,
  contentId: string,
) {
  await takeRateLimit(database, userId, 'delete-content', 10, 3_600);

  await transaction(database, async (client) => {
    // 사진 업로드·확정과 같은 잠금 순서를 써서 동시 작업의 교착 위험을 줄입니다.
    await queryClient(
      client,
      'select id from community_settings where id = true for update',
    );
    const target = await lockTarget(client, contentType, contentId);
    if (!target) {
      throw new ModerationError(
        404,
        'CONTENT_NOT_FOUND',
        '게시물을 찾지 못했습니다.',
      );
    }
    if (target.user_id !== userId) {
      throw new ModerationError(
        403,
        'CONTENT_NOT_OWNED',
        '본인 게시물만 영구 삭제할 수 있습니다.',
      );
    }
    if (target.status !== 'published') {
      throw new ModerationError(
        409,
        'CONTENT_UNDER_REVIEW',
        '숨김 검토 중인 게시물은 이의제기 기간 동안 직접 삭제할 수 없습니다.',
      );
    }

    const parentColumn = mediaParentColumn(contentType);
    const { rows: mediaRows } = await queryClient<{
      id: string;
      owner_id: string | null;
      object_path: string;
      byte_size: number;
    }>(
      client,
      `select id, owner_id, object_path, byte_size
       from community_media where ${parentColumn} = $1
       order by id for update`,
      [contentId],
    );
    const { rows: reservations } = await queryClient<{
      id: string;
      user_id: string;
      byte_size: number;
      object_path: string | null;
    }>(
      client,
      `select id, user_id, byte_size, object_path
       from media_quota_reservations
       where parent_type = $1 and parent_id = $2
       order by id for update`,
      [contentType, contentId],
    );

    // R2는 PostgreSQL 트랜잭션에 포함되지 않습니다. DB 변경은 롤백되지만
    // 먼저 지운 객체는 복구할 수 없어 이 경계는 운영 중 재검토가 필요합니다.
    for (const file of [...mediaRows, ...reservations]) {
      if (!file.object_path) continue;
      try {
        await bucket.delete(file.object_path);
      } catch {
        throw new ModerationError(
          503,
          'MEDIA_STORAGE_UNAVAILABLE',
          '첨부 사진을 정리하지 못했습니다. 게시물은 보존했습니다.',
        );
      }
    }

    for (const media of mediaRows) {
      if (!media.owner_id) continue;
      await queryClient(
        client,
        `update user_media_usage
         set image_count = greatest(0, image_count - 1),
             bytes_used = greatest(0, bytes_used - $2), updated_at = now()
         where user_id = $1`,
        [media.owner_id, media.byte_size],
      );
    }
    for (const reservation of reservations) {
      await queryClient(
        client,
        `update user_media_usage
         set images_reserved = greatest(0, images_reserved - 1),
             bytes_reserved = greatest(0, bytes_reserved - $2), updated_at = now()
         where user_id = $1`,
        [reservation.user_id, reservation.byte_size],
      );
    }

    const usedBytes = mediaRows.reduce(
      (sum, media) => sum + media.byte_size,
      0,
    );
    const reservedBytes = reservations.reduce(
      (sum, reservation) => sum + reservation.byte_size,
      0,
    );
    if (usedBytes || reservedBytes) {
      await queryClient(
        client,
        `update community_settings
         set storage_used_bytes = greatest(0, storage_used_bytes - $1),
             storage_reserved_bytes = greatest(0, storage_reserved_bytes - $2),
             updated_at = now()
         where id = true`,
        [usedBytes, reservedBytes],
      );
    }
    await queryClient(
      client,
      `delete from community_media where ${parentColumn} = $1`,
      [contentId],
    );
    await queryClient(
      client,
      'delete from media_quota_reservations where parent_type = $1 and parent_id = $2',
      [contentType, contentId],
    );
    await queryClient(
      client,
      'delete from content_reports where content_type = $1 and content_id = $2',
      [contentType, contentId],
    );
    await queryClient(
      client,
      'delete from content_appeals where content_type = $1 and content_id = $2',
      [contentType, contentId],
    );
    const { rowCount } = await queryClient(
      client,
      `delete from ${tableFor(contentType)}
       where id = $1 and user_id = $2 and status = 'published'`,
      [contentId, userId],
    );
    if (rowCount !== 1) {
      throw new ModerationError(
        409,
        'CONTENT_DELETE_CONFLICT',
        '게시물 상태가 바뀌어 삭제를 완료하지 못했습니다. 다시 확인해 주세요.',
      );
    }
  });
}

async function assertCommunityEnabled(client: PoolClient) {
  const { rows } = await queryClient<{
    community_enabled: boolean;
    database_bytes: string;
  }>(
    client,
    `
      select settings.community_enabled,
             pg_database_size(current_database())::text as database_bytes
      from community_settings as settings
      where settings.id = true
    `,
  );
  const settings = rows[0];
  if (!settings || !settings.community_enabled) {
    throw new ModerationError(
      503,
      'COMMUNITY_DISABLED',
      '현재 커뮤니티 기능을 사용할 수 없습니다.',
    );
  }
  if (Number(settings.database_bytes) >= 400 * 1024 * 1024) {
    throw new ModerationError(
      503,
      'DATABASE_LIMIT_REACHED',
      '저장 공간 한도에 도달해 커뮤니티 요청을 잠시 중단했습니다.',
    );
  }
}

type TargetRow = {
  id: string;
  user_id: string | null;
  author_name: string;
  body: string;
  status: string;
  created_at: Date;
  hidden_at: Date | null;
  purge_after: Date | null;
};

async function lockTarget(
  client: PoolClient,
  contentType: ModeratedContentType,
  contentId: string,
) {
  const table = tableFor(contentType);
  const { rows } = await queryClient<TargetRow>(
    client,
    `
      select id, user_id, author_name, body, status, created_at, hidden_at,
             purge_after
      from ${table}
      where id = $1
      for update
    `,
    [contentId],
  );
  return rows[0] ?? null;
}

/** 로그인 사용자가 타인의 공개 글을 한 번 신고하도록 자기·중복 신고를 제한합니다. */
export async function createContentReport(
  database: Database,
  userId: string,
  input: {
    contentType: ModeratedContentType;
    contentId: string;
    reason: string;
    details: string | null;
  },
) {
  await takeRateLimit(database, userId, 'report-content', 5, 86_400);
  return transaction(database, async (client) => {
    await assertCommunityEnabled(client);
    const target = await lockTarget(client, input.contentType, input.contentId);
    if (!target) {
      throw new ModerationError(
        404,
        'CONTENT_NOT_FOUND',
        '신고할 게시물을 찾을 수 없습니다.',
      );
    }
    if (target.status !== 'published') {
      throw new ModerationError(
        409,
        'CONTENT_NOT_REPORTABLE',
        '공개 중인 게시물만 신고할 수 있습니다.',
      );
    }
    if (target.user_id === userId) {
      throw new ModerationError(
        403,
        'SELF_REPORT_NOT_ALLOWED',
        '본인 게시물은 신고할 수 없습니다.',
      );
    }

    const { rows } = await queryClient<{ id: string }>(
      client,
      `
        insert into content_reports
          (reporter_id, content_type, content_id, reason, details,
           target_excerpt, target_author)
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (reporter_id, content_type, content_id) do nothing
        returning id
      `,
      [
        userId,
        input.contentType,
        input.contentId,
        input.reason,
        input.details,
        target.body.slice(0, 500),
        target.author_name,
      ],
    );
    if (!rows[0]) {
      throw new ModerationError(
        409,
        'REPORT_ALREADY_EXISTS',
        '이 게시물은 이미 신고하셨습니다.',
      );
    }
    return { reported: true };
  });
}

/** 신고자 세부 정보가 포함된 미처리 신고 목록을 관리자에게만 반환합니다. */
export async function listOpenReports(database: Database, userId: string) {
  await requireAdmin(database, userId);
  await takeRateLimit(database, userId, 'get-admin-reports', 60, 3_600);
  const { rows } = await query(
    database,
    `
      select id, content_type, content_id, reason, details, status,
             created_at, target_excerpt, target_author
      from content_reports
      where status = 'open'
      order by created_at asc
      limit 100
    `,
  );
  return rows;
}

/** 관리자 조정 화면에 숨김 글과 최신 이의제기 상태를 반환합니다. */
export async function listHiddenContent(database: Database, userId: string) {
  await requireAdmin(database, userId);
  await takeRateLimit(database, userId, 'get-admin-hidden-content', 60, 3_600);
  const { rows } = await query(
    database,
    `
      with content as (
        select id, 'guestbook'::text as content_type,
               null::text as schedule_id, user_id, author_name, body,
               null::smallint as rating, created_at, status,
               moderation_reason, hidden_at, purge_after
        from guestbook_posts where status = 'hidden'
        union all
        select id, 'review'::text as content_type, schedule_id, user_id,
               author_name, body, rating, created_at, status,
               moderation_reason, hidden_at, purge_after
        from schedule_reviews where status = 'hidden'
      )
      select content.id, content.content_type, content.schedule_id,
             content.author_name, content.body, content.rating,
             content.created_at, content.status, content.moderation_reason,
             content.hidden_at, content.purge_after,
             (
               select jsonb_build_object(
                 'id', appeal.id, 'reason', appeal.reason,
                 'status', appeal.status, 'submitted_at', appeal.submitted_at,
                 'decided_at', appeal.decided_at,
                 'decision_reason', appeal.decision_reason
               )
               from content_appeals as appeal
               where appeal.content_type = content.content_type
                 and appeal.content_id = content.id
               order by appeal.submitted_at desc limit 1
             ) as appeal,
             coalesce((
               select jsonb_agg(jsonb_build_object(
                 'id', media.id,
                 'signed_url', '/api/v1/media/' || media.id::text
               ) order by media.created_at)
               from community_media as media
               where (content.content_type = 'guestbook'
                      and media.guestbook_post_id = content.id)
                  or (content.content_type = 'review'
                      and media.schedule_review_id = content.id)
             ), '[]'::jsonb) as media
      from content
      order by content.hidden_at desc nulls last, content.created_at desc
      limit 100
    `,
  );
  return rows;
}

/** 작성자는 본인 숨김 글과 7일간 보존되는 이의제기 결과 안내만 조회합니다. */
export async function getMyContent(database: Database, userId: string) {
  await takeRateLimit(database, userId, 'get-my-content', 60, 3_600);
  const { rows: guestbook } = await query(
    database,
    `
      select post.id, 'guestbook'::text as content_type,
             null::text as schedule_id, post.author_name, post.body,
             null::smallint as rating, post.created_at, post.status,
             post.moderation_reason, post.hidden_at, post.purge_after,
             (
               select jsonb_build_object(
                 'id', appeal.id, 'reason', appeal.reason, 'status', appeal.status,
                 'submitted_at', appeal.submitted_at, 'decided_at', appeal.decided_at,
                 'decision_reason', appeal.decision_reason
               )
               from content_appeals as appeal
               where appeal.content_type = 'guestbook' and appeal.content_id = post.id
               order by appeal.submitted_at desc limit 1
             ) as appeal,
             coalesce((
               select jsonb_agg(jsonb_build_object(
                 'id', media.id,
                 'signed_url', '/api/v1/media/' || media.id::text
               ) order by media.created_at)
               from community_media as media
               where media.guestbook_post_id = post.id
             ), '[]'::jsonb) as media
      from guestbook_posts as post
      where post.user_id = $1
      order by post.created_at desc
      limit 100
    `,
    [userId],
  );
  const { rows: reviews } = await query(
    database,
    `
      select review.id, 'review'::text as content_type, review.schedule_id,
             review.author_name, review.body, review.rating, review.created_at,
             review.status, review.moderation_reason, review.hidden_at,
             review.purge_after,
             (
               select jsonb_build_object(
                 'id', appeal.id, 'reason', appeal.reason, 'status', appeal.status,
                 'submitted_at', appeal.submitted_at, 'decided_at', appeal.decided_at,
                 'decision_reason', appeal.decision_reason
               )
               from content_appeals as appeal
               where appeal.content_type = 'review' and appeal.content_id = review.id
               order by appeal.submitted_at desc limit 1
             ) as appeal,
             coalesce((
               select jsonb_agg(jsonb_build_object(
                 'id', media.id,
                 'signed_url', '/api/v1/media/' || media.id::text
               ) order by media.created_at)
               from community_media as media
               where media.schedule_review_id = review.id
             ), '[]'::jsonb) as media
      from schedule_reviews as review
      where review.user_id = $1
      order by review.created_at desc
      limit 100
    `,
    [userId],
  );
  const { rows: appealResults } = await query(
    database,
    `
      select id, content_type, content_created_at, decision_reason,
             decided_at, expires_at
      from content_appeal_results
      where author_id = $1 and expires_at > now()
      order by decided_at desc
      limit 100
    `,
    [userId],
  );
  const posts = [...guestbook, ...reviews]
    .sort((left, right) =>
      String(right.created_at).localeCompare(String(left.created_at)),
    )
    .slice(0, 100);
  return { posts, appealResults };
}

/** 관리자가 공개 글을 숨기고 이의제기 기한 7일과 안내 사유를 기록합니다. */
export async function hideContent(
  database: Database,
  userId: string,
  contentType: ModeratedContentType,
  contentId: string,
  reason: string,
) {
  await requireAdmin(database, userId);
  await takeRateLimit(database, userId, 'hide-content', 20, 3_600);
  return transaction(database, async (client) => {
    await queryClient(
      client,
      'select id from community_settings where id = true for update',
    );
    const target = await lockTarget(client, contentType, contentId);
    if (!target || target.status !== 'published') {
      throw new ModerationError(
        409,
        'CONTENT_NOT_PUBLISHABLE',
        '공개 중인 게시물만 숨길 수 있습니다.',
      );
    }
    const { rows } = await queryClient<{ id: string }>(
      client,
      `
        update ${tableFor(contentType)}
        set status = 'hidden', moderation_reason = $2, hidden_at = now(),
            purge_after = now() + interval '7 days', updated_at = now()
        where id = $1 and status = 'published'
        returning id
      `,
      [contentId, reason],
    );
    if (!rows[0]) {
      throw new ModerationError(
        409,
        'CONTENT_STATE_CHANGED',
        '게시물 상태가 바뀌었습니다. 목록을 새로고침해 주세요.',
      );
    }
    await queryClient(
      client,
      `
        update content_reports
        set status = 'actioned'
        where content_type = $1 and content_id = $2 and status = 'open'
      `,
      [contentType, contentId],
    );
    return { hidden: true };
  });
}

/** 신고를 기각하거나 글을 숨기고 해당 글의 미처리 신고를 함께 닫습니다. */
export async function decideReport(
  database: Database,
  userId: string,
  reportId: string,
  decision: ReportDecision,
  reason: string | null,
) {
  await requireAdmin(database, userId);
  await takeRateLimit(database, userId, 'moderate-report', 40, 3_600);

  const { rows: initialReports } = await query<{
    content_type: ModeratedContentType;
    content_id: string;
  }>(
    database,
    'select content_type, content_id from content_reports where id = $1',
    [reportId],
  );
  const initialReport = initialReports[0];
  if (!initialReport) {
    throw new ModerationError(
      404,
      'REPORT_NOT_FOUND',
      '신고를 찾을 수 없습니다.',
    );
  }

  return transaction(database, async (client) => {
    const target = await lockTarget(
      client,
      initialReport.content_type,
      initialReport.content_id,
    );
    const { rows: reports } = await queryClient<{
      id: string;
      status: string;
      content_type: ModeratedContentType;
      content_id: string;
    }>(
      client,
      'select id, status, content_type, content_id from content_reports where id = $1 for update',
      [reportId],
    );
    const report = reports[0];
    if (
      !report ||
      report.status !== 'open' ||
      report.content_type !== initialReport.content_type ||
      report.content_id !== initialReport.content_id
    ) {
      throw new ModerationError(
        409,
        'REPORT_ALREADY_PROCESSED',
        '이미 처리됐거나 변경된 신고입니다.',
      );
    }

    if (decision === 'dismiss') {
      await queryClient(
        client,
        "update content_reports set status = 'dismissed' where id = $1",
        [report.id],
      );
      return { processed: true, hidden: false };
    }
    if (!target) {
      throw new ModerationError(
        404,
        'CONTENT_NOT_FOUND',
        '신고 대상 게시물을 찾을 수 없습니다.',
      );
    }
    if (target.status === 'published') {
      await queryClient(
        client,
        `
          update ${tableFor(report.content_type)}
          set status = 'hidden', moderation_reason = $2, hidden_at = now(),
              purge_after = now() + interval '7 days', updated_at = now()
          where id = $1 and status = 'published'
        `,
        [report.content_id, reason],
      );
    } else if (target.status !== 'hidden') {
      throw new ModerationError(
        409,
        'CONTENT_NOT_HIDABLE',
        '현재 상태의 게시물은 신고 조치로 숨길 수 없습니다.',
      );
    }
    await queryClient(
      client,
      `
        update content_reports
        set status = 'actioned'
        where content_type = $1 and content_id = $2 and status = 'open'
      `,
      [report.content_type, report.content_id],
    );
    return { processed: true, hidden: true };
  });
}

/** 숨김 글을 공개로 복원하고 연결된 대기 이의제기를 자동 승인합니다. */
export async function restoreContent(
  database: Database,
  userId: string,
  contentType: ModeratedContentType,
  contentId: string,
) {
  await requireAdmin(database, userId);
  await takeRateLimit(database, userId, 'restore-hidden-content', 20, 3_600);
  return transaction(database, async (client) => {
    await queryClient(
      client,
      'select id from community_settings where id = true for update',
    );
    const target = await lockTarget(client, contentType, contentId);
    if (!target || target.status !== 'hidden') {
      throw new ModerationError(
        409,
        'CONTENT_NOT_RESTORABLE',
        '숨김 상태인 게시물을 찾을 수 없습니다.',
      );
    }
    await queryClient(
      client,
      `
        update ${tableFor(contentType)}
        set status = 'published', moderation_reason = null,
            hidden_at = null, purge_after = null, updated_at = now()
        where id = $1 and status = 'hidden'
      `,
      [contentId],
    );
    await queryClient(
      client,
      `
        update content_appeals
        set status = 'approved', decided_at = now(),
            decision_reason = '관리자 검토 후 게시물이 복원되었습니다.'
        where content_type = $1 and content_id = $2 and status = 'pending'
      `,
      [contentType, contentId],
    );
    return { restored: true };
  });
}

/** 작성자가 7일 보존 기한 안에 한 번만 이의제기를 제출하게 합니다. */
export async function submitAppeal(
  database: Database,
  userId: string,
  contentType: ModeratedContentType,
  contentId: string,
  reason: string,
) {
  await takeRateLimit(database, userId, 'submit-appeal', 3, 86_400);
  return transaction(database, async (client) => {
    const target = await lockTarget(client, contentType, contentId);
    if (!target || target.user_id !== userId || target.status !== 'hidden') {
      throw new ModerationError(
        403,
        'APPEAL_NOT_ALLOWED',
        '본인의 숨김 게시물에 대해서만 이의제기할 수 있습니다.',
      );
    }
    if (!target.purge_after || target.purge_after.getTime() <= Date.now()) {
      throw new ModerationError(
        410,
        'APPEAL_WINDOW_EXPIRED',
        '이의제기 기간이 지나 신청할 수 없습니다.',
      );
    }
    const { rows: pending } = await queryClient<{ id: string }>(
      client,
      `
        select id from content_appeals
        where content_type = $1 and content_id = $2 and status = 'pending'
        limit 1
      `,
      [contentType, contentId],
    );
    if (pending[0]) {
      throw new ModerationError(
        409,
        'APPEAL_ALREADY_PENDING',
        '이미 검토 중인 이의제기가 있습니다.',
      );
    }
    const { rows } = await queryClient<{ id: string }>(
      client,
      `
        insert into content_appeals (content_type, content_id, author_id, reason)
        values ($1, $2, $3, $4)
        returning id
      `,
      [contentType, contentId, userId, reason],
    );
    if (!rows[0]) {
      throw new ModerationError(
        503,
        'APPEAL_SAVE_FAILED',
        '이의제기를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
    return { submitted: true, appealId: rows[0].id };
  });
}

/** 이의제기를 트랜잭션으로 처리합니다. 승인 시 복원하고 기각 시 글·사진을 지운 뒤 사유만 7일 보존합니다. */
export async function resolveAppeal(
  database: Database,
  bucket: R2Bucket,
  userId: string,
  appealId: string,
  decision: AppealDecision,
  decisionReason: string | null,
) {
  await requireAdmin(database, userId);
  await takeRateLimit(database, userId, 'resolve-appeal', 20, 3_600);
  const { rows: initialRows } = await query<{
    content_type: ModeratedContentType;
    content_id: string;
    author_id: string;
  }>(
    database,
    'select content_type, content_id, author_id from content_appeals where id = $1',
    [appealId],
  );
  const initial = initialRows[0];
  if (!initial) {
    throw new ModerationError(
      404,
      'APPEAL_NOT_FOUND',
      '이의제기를 찾을 수 없습니다.',
    );
  }

  return transaction(database, async (client) => {
    await queryClient(
      client,
      'select id from community_settings where id = true for update',
    );
    if (initial.author_id) {
      await queryClient(
        client,
        'select user_id from user_media_usage where user_id = $1 for update',
        [initial.author_id],
      );
    }
    const target = await lockTarget(
      client,
      initial.content_type,
      initial.content_id,
    );
    const { rows: appealRows } = await queryClient<{
      id: string;
      content_type: ModeratedContentType;
      content_id: string;
      author_id: string | null;
      status: string;
    }>(
      client,
      `select id, content_type, content_id, author_id, status
       from content_appeals where id = $1 for update`,
      [appealId],
    );
    const appeal = appealRows[0];
    if (
      !appeal ||
      appeal.status !== 'pending' ||
      appeal.content_type !== initial.content_type ||
      appeal.content_id !== initial.content_id ||
      appeal.author_id !== initial.author_id
    ) {
      throw new ModerationError(
        409,
        'APPEAL_ALREADY_RESOLVED',
        '이미 처리됐거나 변경된 이의제기입니다.',
      );
    }
    if (
      !target ||
      target.status !== 'hidden' ||
      target.user_id !== appeal.author_id
    ) {
      throw new ModerationError(
        409,
        'APPEAL_CONTENT_UNAVAILABLE',
        '이의제기 대상 게시물을 찾을 수 없거나 상태가 바뀌었습니다.',
      );
    }

    if (decision === 'approve') {
      await queryClient(
        client,
        `
          update ${tableFor(appeal.content_type)}
          set status = 'published', moderation_reason = null,
              hidden_at = null, purge_after = null, updated_at = now()
          where id = $1 and status = 'hidden'
        `,
        [appeal.content_id],
      );
      await queryClient(
        client,
        `
          update content_appeals
          set status = 'approved', decided_at = now(), decision_reason = $2
          where id = $1 and status = 'pending'
        `,
        [appeal.id, decisionReason],
      );
      return { decision: 'approve' as const };
    }

    if (!decisionReason || !appeal.author_id) {
      throw new ModerationError(
        400,
        'APPEAL_REJECTION_REASON_REQUIRED',
        '기각 사유를 입력해 주세요.',
      );
    }

    const parentColumn = mediaParentColumn(appeal.content_type);
    const { rows: mediaRows } = await queryClient<{
      id: string;
      owner_id: string | null;
      object_path: string;
      byte_size: number;
    }>(
      client,
      `select id, owner_id, object_path, byte_size
       from community_media where ${parentColumn} = $1
       order by owner_id nulls last, id for update`,
      [appeal.content_id],
    );
    for (const media of mediaRows) {
      try {
        await bucket.delete(media.object_path);
      } catch {
        throw new ModerationError(
          503,
          'MEDIA_STORAGE_UNAVAILABLE',
          '첨부 사진을 정리하지 못했습니다. 게시물과 이의제기 상태는 보존했습니다.',
        );
      }
    }

    for (const media of mediaRows) {
      if (media.owner_id) {
        await queryClient(
          client,
          `
            update user_media_usage
            set image_count = greatest(0, image_count - 1),
                bytes_used = greatest(0, bytes_used - $2), updated_at = now()
            where user_id = $1
          `,
          [media.owner_id, media.byte_size],
        );
      }
    }
    const totalMediaBytes = mediaRows.reduce(
      (sum, media) => sum + media.byte_size,
      0,
    );
    if (totalMediaBytes > 0) {
      await queryClient(
        client,
        `
          update community_settings
          set storage_used_bytes = greatest(0, storage_used_bytes - $1),
              updated_at = now()
          where id = true
        `,
        [totalMediaBytes],
      );
      await queryClient(
        client,
        `delete from community_media where ${parentColumn} = $1`,
        [appeal.content_id],
      );
    }
    const { rows: resultRows } = await queryClient<{ expires_at: Date }>(
      client,
      `
        insert into content_appeal_results
          (author_id, content_type, content_created_at, decision_reason,
           decided_at, expires_at)
        values ($1, $2, $3, $4, now(), now() + interval '7 days')
        returning expires_at
      `,
      [
        appeal.author_id,
        appeal.content_type,
        target.created_at,
        decisionReason,
      ],
    );
    await queryClient(
      client,
      'delete from content_reports where content_type = $1 and content_id = $2',
      [appeal.content_type, appeal.content_id],
    );
    const { rowCount } = await queryClient(
      client,
      `delete from ${tableFor(appeal.content_type)}
       where id = $1 and status = 'hidden'`,
      [appeal.content_id],
    );
    if (rowCount !== 1) {
      throw new ModerationError(
        409,
        'APPEAL_CONTENT_UNAVAILABLE',
        '게시물 상태가 바뀌어 최종 삭제하지 못했습니다.',
      );
    }
    await queryClient(
      client,
      'delete from content_appeals where content_type = $1 and content_id = $2',
      [appeal.content_type, appeal.content_id],
    );
    return {
      decision: 'reject' as const,
      expiresAt: resultRows[0]?.expires_at ?? null,
    };
  });
}

type ExpiredContent = {
  id: string;
  content_type: ModeratedContentType;
};

/** Cron에서 제한된 묶음으로 만료된 숨김 글·결과 안내를 지우고 사진 용량을 정산합니다. */
export async function purgeExpiredCommunityContent(
  database: Database,
  bucket: R2Bucket,
  batchSize = 50,
) {
  const boundedBatchSize = Math.max(1, Math.min(50, batchSize));
  const { rows: expiredResults } = await query<{ id: string }>(
    database,
    `
      with expired as (
        select id
        from content_appeal_results
        where expires_at <= now()
        order by expires_at
        limit 500
      )
      delete from content_appeal_results as result
      using expired
      where result.id = expired.id
      returning result.id
    `,
  );
  const { rows: candidates } = await query<ExpiredContent>(
    database,
    `
      select expired.id, expired.content_type
      from (
        (
          select id, 'guestbook'::text as content_type, purge_after
          from guestbook_posts
          where status = 'hidden' and purge_after <= now()
          order by purge_after
          limit $1
        )
        union all
        (
          select id, 'review'::text as content_type, purge_after
          from schedule_reviews
          where status = 'hidden' and purge_after <= now()
          order by purge_after
          limit $1
        )
      ) as expired
      order by expired.purge_after
    `,
    [boundedBatchSize],
  );

  let purged = 0;
  let waitingForAppeal = 0;
  let failed = 0;
  for (const candidate of candidates) {
    let claimed = false;
    try {
      const claimState = await transaction(database, async (client) => {
        const target = await lockTarget(
          client,
          candidate.content_type,
          candidate.id,
        );
        if (
          !target ||
          target.status !== 'hidden' ||
          !target.purge_after ||
          target.purge_after.getTime() > Date.now()
        ) {
          return 'skipped' as const;
        }
        const { rows: pending } = await queryClient<{ exists: boolean }>(
          client,
          `
            select exists(
              select 1 from content_appeals
              where content_type = $1 and content_id = $2 and status = 'pending'
            ) as exists
          `,
          [candidate.content_type, candidate.id],
        );
        if (pending[0]?.exists) return 'pending' as const;
        await queryClient(
          client,
          `update ${tableFor(candidate.content_type)}
           set status = 'purging', updated_at = now()
           where id = $1 and status = 'hidden'`,
          [candidate.id],
        );
        return 'claimed' as const;
      });
      if (claimState === 'pending') {
        waitingForAppeal += 1;
        continue;
      }
      if (claimState !== 'claimed') continue;
      claimed = true;

      const parentColumn = mediaParentColumn(candidate.content_type);
      const { rows: mediaRows } = await query<{
        owner_id: string | null;
        object_path: string;
        byte_size: number;
      }>(
        database,
        `select owner_id, object_path, byte_size
         from community_media where ${parentColumn} = $1 order by id`,
        [candidate.id],
      );
      for (const media of mediaRows) {
        await bucket.delete(media.object_path);
      }

      await transaction(database, async (client) => {
        await queryClient(
          client,
          'select id from community_settings where id = true for update',
        );
        const target = await lockTarget(
          client,
          candidate.content_type,
          candidate.id,
        );
        if (!target || target.status !== 'purging') {
          throw new ModerationError(
            409,
            'PURGE_CLAIM_LOST',
            '예약 삭제 상태가 바뀌어 정리를 다시 시도해야 합니다.',
          );
        }
        const { rows: lockedMedia } = await queryClient<{
          owner_id: string | null;
          byte_size: number;
        }>(
          client,
          `select owner_id, byte_size from community_media
           where ${parentColumn} = $1 for update`,
          [candidate.id],
        );
        for (const media of lockedMedia) {
          if (media.owner_id) {
            await queryClient(
              client,
              `
                update user_media_usage
                set image_count = greatest(0, image_count - 1),
                    bytes_used = greatest(0, bytes_used - $2), updated_at = now()
                where user_id = $1
              `,
              [media.owner_id, media.byte_size],
            );
          }
        }
        const totalMediaBytes = lockedMedia.reduce(
          (sum, media) => sum + media.byte_size,
          0,
        );
        if (totalMediaBytes > 0) {
          await queryClient(
            client,
            `
              update community_settings
              set storage_used_bytes = greatest(0, storage_used_bytes - $1),
                  updated_at = now()
              where id = true
            `,
            [totalMediaBytes],
          );
        }
        await queryClient(
          client,
          `delete from community_media where ${parentColumn} = $1`,
          [candidate.id],
        );
        await queryClient(
          client,
          'delete from content_reports where content_type = $1 and content_id = $2',
          [candidate.content_type, candidate.id],
        );
        await queryClient(
          client,
          'delete from content_appeals where content_type = $1 and content_id = $2',
          [candidate.content_type, candidate.id],
        );
        const { rowCount } = await queryClient(
          client,
          `delete from ${tableFor(candidate.content_type)}
           where id = $1 and status = 'purging'`,
          [candidate.id],
        );
        if (rowCount !== 1) {
          throw new ModerationError(
            409,
            'PURGE_CLAIM_LOST',
            '예약 삭제 상태가 바뀌어 정리를 다시 시도해야 합니다.',
          );
        }
      });
      purged += 1;
    } catch {
      failed += 1;
      if (claimed) {
        await query(
          database,
          `update ${tableFor(candidate.content_type)}
           set status = 'hidden', updated_at = now()
           where id = $1 and status = 'purging'`,
          [candidate.id],
        ).catch(() => undefined);
      }
    }
  }
  return {
    purged,
    waitingForAppeal,
    failed,
    appealResultsRemoved: expiredResults.length,
  };
}
