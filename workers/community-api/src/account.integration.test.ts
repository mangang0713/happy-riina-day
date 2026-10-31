// 전용 로컬 PostgreSQL에서 탈퇴 익명화와 계정 소유 데이터 정리를 확인합니다.
// WORKER_TEST_DATABASE_URL이 없으면 실제 DB를 건드리지 않도록 통합 검사를 건너뜁니다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { serializeSignedCookie } from 'better-call';
import { createAuth } from './auth';
import type { WorkerEnv } from './env';

const connectionString = process.env.WORKER_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration('account deletion with local PostgreSQL', () => {
  const accountId = `worker-qa-account-delete-${crypto.randomUUID()}`;
  const otherUserId = `worker-qa-account-other-${crypto.randomUUID()}`;
  const reportTargetAuthor = `QA target-${crypto.randomUUID().slice(0, 16)}`;
  const postIds: string[] = [];
  const reviewIds: string[] = [];
  const mediaObjects = new Map<string, Uint8Array>();
  const database = new Pool({ connectionString });
  const byteArrays = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
  const paths = [
    `qa/${accountId}/guestbook.webp`,
    `qa/${accountId}/review.webp`,
    `qa/${accountId}/pending.webp`,
  ];
  const mediaBucket = {
    delete: async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        mediaObjects.delete(key);
      }
    },
  } as unknown as R2Bucket;
  const authUrl = 'http://127.0.0.1:8791';
  const auth = createAuth(
    {
      ASSETS: { fetch: async () => new Response('') },
      HYPERDRIVE: { connectionString },
      MEDIA_BUCKET: mediaBucket,
      BETTER_AUTH_SECRET: 'local-account-deletion-integration-secret-000000',
      BETTER_AUTH_URL: authUrl,
      APP_ORIGIN: authUrl,
    } as unknown as WorkerEnv,
    database,
  );
  let freshSessionToken = '';
  let staleSessionToken = '';

  beforeAll(async () => {
    await database.query(
      `insert into "user" (id, name, email)
       values ($1, 'QA Deletion User', $2), ($3, 'QA Other User', $4)`,
      [
        accountId,
        `${accountId}@example.invalid`,
        otherUserId,
        `${otherUserId}@example.invalid`,
      ],
    );
    await database.query(
      `insert into profiles (id, display_name)
       values ($1, 'QA Deletion User'), ($2, 'QA Other User')`,
      [accountId, otherUserId],
    );
    await database.query('insert into admin_members (user_id) values ($1)', [
      accountId,
    ]);
    await database.query(
      `insert into account (id, "accountId", "providerId", "userId")
       values ($1, 'qa-provider-id', 'google', $1)`,
      [accountId],
    );
    const authContext = await auth.$context;
    const freshSession = await authContext.internalAdapter.createSession(
      accountId,
      false,
    );
    const staleSession = await authContext.internalAdapter.createSession(
      accountId,
      false,
      { createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    );
    freshSessionToken = freshSession.token;
    staleSessionToken = staleSession.token;
    await database.query(
      `update session
       set "createdAt" = now() - interval '2 days'
       where token = $1`,
      [staleSessionToken],
    );

    const post = await database.query<{ id: string }>(
      `insert into guestbook_posts
         (user_id, author_name, body, status, moderation_reason, hidden_at, purge_after)
       values ($1, 'QA Deletion User', 'QA guestbook entry', 'hidden',
               'QA moderation reason', now(), now() + interval '7 days')
       returning id`,
      [accountId],
    );
    postIds.push(post.rows[0].id);
    const review = await database.query<{ id: string }>(
      `insert into schedule_reviews
         (schedule_id, user_id, author_name, rating, body)
       values ('qa-account-deletion-schedule', $1, 'QA Deletion User', 5,
               'QA schedule review')
       returning id`,
      [accountId],
    );
    reviewIds.push(review.rows[0].id);

    await database.query(
      `insert into schedule_likes (schedule_id, user_id)
       values ('qa-account-deletion-schedule', $1)`,
      [accountId],
    );
    await database.query(
      `insert into community_media
         (owner_id, guestbook_post_id, object_path, content_type, byte_size)
       values ($1, $2, $3, 'image/webp', 100)`,
      [accountId, postIds[0], paths[0]],
    );
    await database.query(
      `insert into community_media
         (owner_id, schedule_review_id, object_path, content_type, byte_size)
       values ($1, $2, $3, 'image/webp', 200)`,
      [accountId, reviewIds[0], paths[1]],
    );
    await database.query(
      `insert into user_media_usage
         (user_id, image_count, bytes_used, images_reserved, bytes_reserved)
       values ($1, 2, 300, 1, 50)`,
      [accountId],
    );
    await database.query(
      `insert into media_quota_reservations
         (user_id, byte_size, parent_type, parent_id, object_path)
       values ($1, 50, 'guestbook', $2, $3)`,
      [accountId, postIds[0], paths[2]],
    );
    await database.query(
      `update community_settings
       set storage_used_bytes = storage_used_bytes + 300,
           storage_reserved_bytes = storage_reserved_bytes + 50
       where id = true`,
    );
    await database.query(
      `insert into community_rate_limits (user_id, action, window_start, request_count)
       values ($1, 'qa-account-deletion', now(), 1)`,
      [accountId],
    );
    await database.query(
      `insert into content_reports
         (reporter_id, content_type, content_id, reason, target_excerpt, target_author)
       values ($1, 'review', $2, 'QA reason', 'QA target excerpt', $3),
              ($4, 'guestbook', $5, 'QA reason', 'QA guestbook excerpt', 'QA Deletion User')`,
      [
        accountId,
        crypto.randomUUID(),
        reportTargetAuthor,
        otherUserId,
        postIds[0],
      ],
    );
    await database.query(
      `insert into content_appeals
         (content_type, content_id, author_id, reason, status)
       values ('guestbook', $2, $1, 'QA appeal', 'pending')`,
      [accountId, postIds[0]],
    );
    await database.query(
      `insert into content_appeal_results
         (author_id, content_type, content_created_at, decision_reason)
       values ($1, 'guestbook', now(), 'QA appeal result')`,
      [accountId],
    );
    byteArrays.forEach((bytes, index) => mediaObjects.set(paths[index], bytes));
    mediaObjects.set(paths[2], new Uint8Array([7, 8, 9]));
  });

  afterAll(async () => {
    try {
      const media = await database.query<{ bytes: string }>(
        `select coalesce(sum(byte_size), 0)::text as bytes
         from community_media
         where owner_id = $1 or guestbook_post_id = any($2::uuid[])
            or schedule_review_id = any($3::uuid[])`,
        [accountId, postIds, reviewIds],
      );
      const reservations = await database.query<{ bytes: string }>(
        `select coalesce(sum(byte_size), 0)::text as bytes
         from media_quota_reservations where user_id = $1`,
        [accountId],
      );
      await database.query(
        `update community_settings
         set storage_used_bytes = greatest(0, storage_used_bytes - $1::bigint),
             storage_reserved_bytes = greatest(0, storage_reserved_bytes - $2::bigint),
             updated_at = now()
         where id = true`,
        [media.rows[0]?.bytes ?? '0', reservations.rows[0]?.bytes ?? '0'],
      );
      await database.query(
        `delete from content_appeal_results where author_id = $1`,
        [accountId],
      );
      await database.query(
        `delete from content_appeals
         where author_id = $1 or content_id = any($2::uuid[])`,
        [accountId, postIds],
      );
      await database.query(
        `delete from content_reports
         where reporter_id = $1 or content_id = any($2::uuid[]) or target_author = $3`,
        [accountId, postIds, reportTargetAuthor],
      );
      await database.query(
        `delete from community_media
         where owner_id = $1 or guestbook_post_id = any($2::uuid[])
            or schedule_review_id = any($3::uuid[])`,
        [accountId, postIds, reviewIds],
      );
      await database.query(
        'delete from media_quota_reservations where user_id = $1',
        [accountId],
      );
      await database.query('delete from schedule_likes where user_id = $1', [
        accountId,
      ]);
      await database.query(
        'delete from guestbook_posts where id = any($1::uuid[])',
        [postIds],
      );
      await database.query(
        'delete from schedule_reviews where id = any($1::uuid[])',
        [reviewIds],
      );
      await database.query('delete from "user" where id = any($1::text[])', [
        [accountId, otherUserId],
      ]);
      mediaObjects.clear();
    } finally {
      await database.end();
    }
  });

  it('requires a fresh session and anonymizes community data before account deletion', async () => {
    const requestDelete = async (token: string) => {
      const signedCookie = await serializeSignedCookie(
        'better-auth.session_token',
        token,
        'local-account-deletion-integration-secret-000000',
        { path: '/' },
      );
      return auth.handler(
        new Request(`${authUrl}/api/auth/delete-user`, {
          method: 'POST',
          headers: {
            cookie: signedCookie.split(';', 1)[0],
            origin: authUrl,
            'content-type': 'application/json',
          },
          body: '{}',
        }),
      );
    };
    const staleResponse = await requestDelete(staleSessionToken);
    expect(staleResponse.status).toBe(400);
    const userAfterStaleAttempt = await database.query(
      'select id from "user" where id = $1',
      [accountId],
    );
    expect(userAfterStaleAttempt.rowCount).toBe(1);
    expect(mediaObjects.size).toBe(3);

    const response = await requestDelete(freshSessionToken);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      message: 'User deleted',
    });
    expect([...mediaObjects.keys()]).toEqual([]);

    const posts = await database.query<{
      user_id: string | null;
      author_name: string;
      status: string;
      moderation_reason: string;
    }>(
      'select user_id, author_name, status, moderation_reason from guestbook_posts where id = $1',
      [postIds[0]],
    );
    expect(posts.rows[0]).toMatchObject({
      user_id: null,
      author_name: '익명 사용자',
      status: 'hidden',
      moderation_reason: 'QA moderation reason',
    });

    const review = await database.query<{
      user_id: string | null;
      author_name: string;
    }>('select user_id, author_name from schedule_reviews where id = $1', [
      reviewIds[0],
    ]);
    expect(review.rows[0]).toEqual({
      user_id: null,
      author_name: '익명 사용자',
    });

    const linkedData = await database.query<{ count: number }>(
      `select (
        (select count(*) from community_media where owner_id = $1) +
        (select count(*) from media_quota_reservations where user_id = $1) +
        (select count(*) from schedule_likes where user_id = $1) +
        (select count(*) from content_appeals where author_id = $1)
      )::integer as count`,
      [accountId],
    );
    expect(linkedData.rows[0].count).toBe(0);

    const authRows = await database.query<{ count: number }>(
      `select (
        (select count(*) from session where "userId" = $1) +
        (select count(*) from account where "userId" = $1) +
        (select count(*) from profiles where id = $1) +
        (select count(*) from admin_members where user_id = $1) +
        (select count(*) from user_media_usage where user_id = $1) +
        (select count(*) from community_rate_limits where user_id = $1) +
        (select count(*) from content_appeal_results where author_id = $1)
      )::integer as count`,
      [accountId],
    );
    expect(authRows.rows[0].count).toBe(0);

    const reports = await database.query<{
      reporter_id: string | null;
      target_author: string;
    }>(
      `select reporter_id, target_author from content_reports
       where content_id = $1 or target_author = $2
       order by reporter_id nulls first`,
      [postIds[0], reportTargetAuthor],
    );
    expect(reports.rows).toEqual([
      { reporter_id: null, target_author: reportTargetAuthor },
      { reporter_id: otherUserId, target_author: 'QA Deletion User' },
    ]);
  });
});
