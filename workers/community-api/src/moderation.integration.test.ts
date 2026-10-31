// 격리된 로컬 QA 계정으로 신고·숨김·이의제기·만료 정리·사진 보존을 점검합니다.
// WORKER_TEST_DATABASE_URL이 없으면 운영 DB에 연결하지 않고 통합 검사를 건너뜁니다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createWorkerApp } from './index';
import { purgeExpiredCommunityContent } from './moderation';
import type { WorkerEnv } from './env';

const connectionString = process.env.WORKER_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration('moderation API with local PostgreSQL', () => {
  const authorId = `worker-qa-author-${crypto.randomUUID()}`;
  const reporterId = `worker-qa-reporter-${crypto.randomUUID()}`;
  const adminId = `worker-qa-admin-${crypto.randomUUID()}`;
  const otherId = `worker-qa-other-${crypto.randomUUID()}`;
  const expiredAuthorId = `worker-qa-expired-author-${crypto.randomUUID()}`;
  const userIds = [authorId, reporterId, adminId, otherId, expiredAuthorId];
  const sessions = new Map([
    ['author', authorId],
    ['reporter', reporterId],
    ['admin', adminId],
    ['other', otherId],
    ['expired-author', expiredAuthorId],
  ]);
  const storage = new Map<string, Uint8Array>();
  const createdPostIds: string[] = [];
  const createdReviewIds: string[] = [];
  const adminPool = new Pool({ connectionString });
  const app = createWorkerApp({
    createDatabase: (env) =>
      new Pool({ connectionString: env.HYPERDRIVE.connectionString }),
    resolveUserId: async (_env, _database, headers) => {
      const key = headers.get('Cookie')?.match(/session=([^;]+)/)?.[1];
      return key ? sessions.get(key) ?? null : null;
    },
    verifyTurnstile: async () => 'verified',
  });
  const env = {
    ASSETS: { fetch: async () => new Response('') },
    HYPERDRIVE: { connectionString },
    MEDIA_BUCKET: {
      put: async (key: string, value: ArrayBuffer | ArrayBufferView) => {
        const bytes =
          value instanceof ArrayBuffer
            ? new Uint8Array(value)
            : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        storage.set(key, bytes.slice());
        return {};
      },
      get: async (key: string) => {
        const bytes = storage.get(key);
        if (!bytes) return null;
        return {
          body: new Blob([bytes.slice().buffer]).stream(),
          httpEtag: '"moderation-media-etag"',
        } as unknown as R2ObjectBody;
      },
      delete: async (key: string) => {
        storage.delete(key);
      },
    } as unknown as R2Bucket,
    BETTER_AUTH_SECRET: 'local-moderation-integration-only-secret-000000000000',
    BETTER_AUTH_URL: 'http://127.0.0.1:8791',
    APP_ORIGIN: 'http://127.0.0.1:8791',
  } as unknown as WorkerEnv;

  beforeAll(async () => {
    await adminPool.query(
      `insert into "user" (id, name, email)
       values ($1, 'QA Author', $2), ($3, 'QA Reporter', $4),
              ($5, 'QA Admin', $6), ($7, 'QA Other', $8),
              ($9, 'QA Expired Author', $10)`,
      [
        authorId,
        `${authorId}@accounts.invalid`,
        reporterId,
        `${reporterId}@accounts.invalid`,
        adminId,
        `${adminId}@accounts.invalid`,
        otherId,
        `${otherId}@accounts.invalid`,
        expiredAuthorId,
        `${expiredAuthorId}@accounts.invalid`,
      ],
    );
    await adminPool.query(
      `insert into profiles (id, display_name)
       values ($1, '로컬 QA 작성자'), ($2, '로컬 QA 신고자'),
              ($3, '로컬 QA 관리자'), ($4, '로컬 QA 다른 사용자'),
              ($5, '로컬 QA 기한 확인 사용자')`,
      userIds,
    );
    await adminPool.query('insert into admin_members (user_id) values ($1)', [
      adminId,
    ]);

    const approvalPost = await adminPool.query<{ id: string }>(
      `insert into guestbook_posts (user_id, author_name, body)
       values ($1, '로컬 QA 작성자', '승인 흐름용 합성 게시물입니다.') returning id`,
      [authorId],
    );
    const rejectionPost = await adminPool.query<{ id: string }>(
      `insert into guestbook_posts (user_id, author_name, body)
       values ($1, '로컬 QA 기한 확인 사용자', '기각 흐름용 합성 게시물입니다.') returning id`,
      [expiredAuthorId],
    );
    const review = await adminPool.query<{ id: string }>(
      `insert into schedule_reviews
         (schedule_id, user_id, author_name, rating, body)
       values ('local-qa-schedule', $1, '로컬 QA 작성자', 5,
               '복원 흐름용 합성 일정 후기입니다.') returning id`,
      [authorId],
    );
    const expiredPost = await adminPool.query<{ id: string }>(
      `insert into guestbook_posts
         (user_id, author_name, body, status, moderation_reason, hidden_at, purge_after)
       values ($1, '로컬 QA 기한 확인 사용자', '기간 만료 확인용 합성 게시물입니다.',
               'hidden', 'QA 숨김 사유', now() - interval '8 days',
               now() - interval '1 day') returning id`,
      [expiredAuthorId],
    );
    const pendingExpiredPost = await adminPool.query<{ id: string }>(
      `insert into guestbook_posts
         (user_id, author_name, body, status, moderation_reason, hidden_at, purge_after)
       values ($1, '로컬 QA 작성자', '진행 중 이의제기 보존 확인용 합성 게시물입니다.',
               'hidden', 'QA 보존 사유', now() - interval '8 days',
               now() - interval '1 day') returning id`,
      [authorId],
    );
    await adminPool.query(
      `insert into content_appeals
         (content_type, content_id, author_id, reason, status)
       values ('guestbook', $1, $2, '테스트 중인 이의제기', 'pending')`,
      [pendingExpiredPost.rows[0].id, authorId],
    );
    createdPostIds.push(
      approvalPost.rows[0].id,
      rejectionPost.rows[0].id,
      expiredPost.rows[0].id,
      pendingExpiredPost.rows[0].id,
    );
    createdReviewIds.push(review.rows[0].id);

    const mediaBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const mediaEntries = [
      {
        postId: approvalPost.rows[0].id,
        objectPath: `qa/moderation/${crypto.randomUUID()}-approve.webp`,
        ownerId: authorId,
      },
      {
        postId: rejectionPost.rows[0].id,
        objectPath: `qa/moderation/${crypto.randomUUID()}-reject.webp`,
        ownerId: expiredAuthorId,
      },
    ];
    for (const media of mediaEntries) {
      storage.set(media.objectPath, mediaBytes.slice());
      await adminPool.query(
        `insert into community_media
           (owner_id, guestbook_post_id, object_path, content_type, byte_size)
         values ($1, $2, $3, 'image/webp', $4)`,
        [media.ownerId, media.postId, media.objectPath, mediaBytes.byteLength],
      );
    }
    await adminPool.query(
      `insert into user_media_usage (user_id, image_count, bytes_used)
       values ($1, 1, $2), ($3, 1, $2)`,
      [authorId, mediaBytes.byteLength, expiredAuthorId],
    );
    await adminPool.query(
      `update community_settings
       set storage_used_bytes = storage_used_bytes + $1 where id = true`,
      [2 * mediaBytes.byteLength],
    );
  });

  afterAll(async () => {
    try {
      const media = await adminPool.query<{ bytes: string }>(
        `select coalesce(sum(byte_size), 0)::text as bytes
         from community_media where owner_id = any($1::text[])`,
        [userIds],
      );
      await adminPool.query(
        'delete from content_appeal_results where author_id = any($1::text[])',
        [userIds],
      );
      await adminPool.query(
        `delete from content_appeals
         where author_id = any($1::text[]) or content_id = any($2::uuid[])`,
        [userIds, [...createdPostIds, ...createdReviewIds]],
      );
      await adminPool.query(
        `delete from content_reports
         where reporter_id = any($1::text[]) or content_id = any($2::uuid[])`,
        [userIds, [...createdPostIds, ...createdReviewIds]],
      );
      await adminPool.query(
        'delete from guestbook_posts where id = any($1::uuid[])',
        [createdPostIds],
      );
      await adminPool.query(
        'delete from schedule_reviews where id = any($1::uuid[])',
        [createdReviewIds],
      );
      await adminPool.query(
        `update community_settings
         set storage_used_bytes = greatest(0, storage_used_bytes - $1),
             updated_at = now() where id = true`,
        [media.rows[0]?.bytes ?? '0'],
      );
      await adminPool.query('delete from admin_members where user_id = $1', [
        adminId,
      ]);
      await adminPool.query('delete from "user" where id = any($1::text[])', [
        userIds,
      ]);
      storage.clear();
    } finally {
      await adminPool.end();
    }
  });

  it('protects reports, hides and restores content, and preserves appeal results', async () => {
    const approvalPostId = createdPostIds[0];
    const rejectionPostId = createdPostIds[1];
    const reviewId = createdReviewIds[0];
    const expiredPostId = createdPostIds[2];
    const approvalObjectPath = [...storage.keys()].find((key) =>
      key.endsWith('-approve.webp'),
    );
    const rejectionObjectPath = [...storage.keys()].find((key) =>
      key.endsWith('-reject.webp'),
    );
    expect(approvalObjectPath).toBeTruthy();
    expect(rejectionObjectPath).toBeTruthy();

    const jsonRequest = (session: string, body: Record<string, unknown>) => ({
      method: 'POST',
      headers: {
        Cookie: `session=${session}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const selfReport = await app.request(
      '/api/v1/reports',
      jsonRequest('author', {
        contentType: 'guestbook',
        contentId: approvalPostId,
        reason: '스팸',
      }),
      env,
    );
    expect(selfReport.status).toBe(403);

    const reportResponse = await app.request(
      '/api/v1/reports',
      jsonRequest('reporter', {
        contentType: 'guestbook',
        contentId: approvalPostId,
        reason: '부적절한 내용',
        details: '운영자가 확인할 수 있는 합성 설명입니다.',
      }),
      env,
    );
    expect(reportResponse.status).toBe(201);
    const reports = await app.request(
      '/api/v1/admin/reports',
      { headers: { Cookie: 'session=admin' } },
      env,
    );
    expect(reports.status).toBe(200);
    const reportList = (await reports.json()) as Array<{
      id: string;
      content_id: string;
      details: string;
    }>;
    const report = reportList.find(
      (item) => item.content_id === approvalPostId,
    );
    expect(report?.details).toBe('운영자가 확인할 수 있는 합성 설명입니다.');
    expect(report).toBeTruthy();

    const forbiddenAdminRead = await app.request(
      '/api/v1/admin/reports',
      { headers: { Cookie: 'session=reporter' } },
      env,
    );
    expect(forbiddenAdminRead.status).toBe(403);
    const reportId = report?.id;
    expect(reportId).toBeTruthy();
    const hidden = await app.request(
      `/api/v1/admin/reports/${reportId}/decision`,
      jsonRequest('admin', { decision: 'hide', reason: '운영 정책 위반 확인' }),
      env,
    );
    expect(hidden.status).toBe(200);
    expect(await hidden.json()).toEqual({ processed: true, hidden: true });
    const hiddenRow = await adminPool.query<{
      status: string;
      moderation_reason: string;
      purge_after: Date;
    }>(
      'select status, moderation_reason, purge_after from guestbook_posts where id = $1',
      [approvalPostId],
    );
    expect(hiddenRow.rows[0]?.status).toBe('hidden');
    expect(hiddenRow.rows[0]?.moderation_reason).toBe('운영 정책 위반 확인');
    expect(hiddenRow.rows[0]?.purge_after.getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000,
    );
    const actionedReport = await adminPool.query<{ status: string }>(
      'select status from content_reports where id = $1',
      [reportId],
    );
    expect(actionedReport.rows[0]?.status).toBe('actioned');

    const hiddenMediaForOther = await app.request(
      `/api/v1/media/${
        (
          await adminPool.query<{ id: string }>(
            'select id from community_media where guestbook_post_id = $1',
            [approvalPostId],
          )
        ).rows[0].id
      }`,
      { headers: { Cookie: 'session=other' } },
      env,
    );
    expect(hiddenMediaForOther.status).toBe(404);
    const hiddenMediaForAuthor = await app.request(
      `/api/v1/media/${
        (
          await adminPool.query<{ id: string }>(
            'select id from community_media where guestbook_post_id = $1',
            [approvalPostId],
          )
        ).rows[0].id
      }`,
      { headers: { Cookie: 'session=author' } },
      env,
    );
    expect(hiddenMediaForAuthor.status).toBe(200);
    const hiddenMediaForAdmin = await app.request(
      `/api/v1/media/${
        (
          await adminPool.query<{ id: string }>(
            'select id from community_media where guestbook_post_id = $1',
            [approvalPostId],
          )
        ).rows[0].id
      }`,
      { headers: { Cookie: 'session=admin' } },
      env,
    );
    expect(hiddenMediaForAdmin.status).toBe(200);

    const myHiddenPosts = await app.request(
      '/api/v1/me/content',
      { headers: { Cookie: 'session=author' } },
      env,
    );
    const myHiddenPayload = (await myHiddenPosts.json()) as {
      posts: Array<{ id: string; status: string; moderation_reason: string }>;
      appealResults: unknown[];
    };
    expect(
      myHiddenPayload.posts.find((post) => post.id === approvalPostId),
    ).toMatchObject({
      status: 'hidden',
      moderation_reason: '운영 정책 위반 확인',
    });

    const wrongAuthorAppeal = await app.request(
      `/api/v1/content/guestbook/${approvalPostId}/appeals`,
      jsonRequest('reporter', { reason: '다시 봐 주세요.' }),
      env,
    );
    expect(wrongAuthorAppeal.status).toBe(403);
    const submittedAppeal = await app.request(
      `/api/v1/content/guestbook/${approvalPostId}/appeals`,
      jsonRequest('author', { reason: '운영 검토를 부탁드립니다.' }),
      env,
    );
    expect(submittedAppeal.status).toBe(201);
    const appealPayload = (await submittedAppeal.json()) as {
      appealId: string;
    };
    const duplicateAppeal = await app.request(
      `/api/v1/content/guestbook/${approvalPostId}/appeals`,
      jsonRequest('author', { reason: '중복 제출 시도입니다.' }),
      env,
    );
    expect(duplicateAppeal.status).toBe(409);

    const adminHiddenContent = await app.request(
      '/api/v1/admin/hidden-content',
      { headers: { Cookie: 'session=admin' } },
      env,
    );
    expect(adminHiddenContent.status).toBe(200);
    const hiddenItems = (await adminHiddenContent.json()) as Array<{
      id: string;
      content_type: string;
      appeal: { id: string; status: string } | null;
      media: Array<{ signed_url: string }>;
    }>;
    expect(
      hiddenItems.find((item) => item.id === approvalPostId),
    ).toMatchObject({
      content_type: 'guestbook',
      appeal: { id: appealPayload.appealId, status: 'pending' },
      media: [{ signed_url: expect.stringContaining('/api/v1/media/') }],
    });

    const approved = await app.request(
      `/api/v1/admin/appeals/${appealPayload.appealId}/decision`,
      jsonRequest('admin', { decision: 'approve' }),
      env,
    );
    expect(approved.status).toBe(200);
    expect(await approved.json()).toEqual({ decision: 'approve' });
    const approvedState = await adminPool.query<{
      status: string;
      moderation_reason: string | null;
      appeal_status: string;
    }>(
      `select post.status, post.moderation_reason, appeal.status as appeal_status
       from guestbook_posts as post
       join content_appeals as appeal
         on appeal.content_id = post.id and appeal.content_type = 'guestbook'
       where post.id = $1`,
      [approvalPostId],
    );
    expect(approvedState.rows[0]).toMatchObject({
      status: 'published',
      moderation_reason: null,
      appeal_status: 'approved',
    });

    const reviewReport = await app.request(
      '/api/v1/reports',
      jsonRequest('reporter', {
        contentType: 'review',
        contentId: reviewId,
        reason: '확인 요청',
      }),
      env,
    );
    expect(reviewReport.status).toBe(201);
    const reviewReports = (await (
      await app.request(
        '/api/v1/admin/reports',
        { headers: { Cookie: 'session=admin' } },
        env,
      )
    ).json()) as Array<{ id: string; content_id: string }>;
    const reviewReportId = reviewReports.find(
      (item) => item.content_id === reviewId,
    )?.id;
    expect(reviewReportId).toBeTruthy();
    const dismissed = await app.request(
      `/api/v1/admin/reports/${reviewReportId}/decision`,
      jsonRequest('admin', { decision: 'dismiss' }),
      env,
    );
    expect(dismissed.status).toBe(200);
    const dismissedReview = await adminPool.query<{ status: string }>(
      'select status from schedule_reviews where id = $1',
      [reviewId],
    );
    expect(dismissedReview.rows[0]?.status).toBe('published');

    const hiddenReview = await app.request(
      `/api/v1/admin/content/review/${reviewId}/hide`,
      jsonRequest('admin', { reason: '관리자 직접 숨김 QA' }),
      env,
    );
    expect(hiddenReview.status).toBe(200);
    const reviewAppeal = await app.request(
      `/api/v1/content/review/${reviewId}/appeals`,
      jsonRequest('author', { reason: '후기 복원 검토 요청' }),
      env,
    );
    expect(reviewAppeal.status).toBe(201);
    const reviewAppealPayload = (await reviewAppeal.json()) as {
      appealId: string;
    };
    const restoredReview = await app.request(
      `/api/v1/admin/content/review/${reviewId}/restore`,
      { method: 'POST', headers: { Cookie: 'session=admin' } },
      env,
    );
    expect(restoredReview.status).toBe(200);
    const restoredState = await adminPool.query<{
      status: string;
      appeal_status: string;
      decision_reason: string;
    }>(
      `select review.status, appeal.status as appeal_status,
              appeal.decision_reason
       from schedule_reviews as review
       join content_appeals as appeal on appeal.content_id = review.id
       where review.id = $1`,
      [reviewId],
    );
    expect(restoredState.rows[0]).toMatchObject({
      status: 'published',
      appeal_status: 'approved',
      decision_reason: '관리자 검토 후 게시물이 복원되었습니다.',
    });
    expect(reviewAppealPayload.appealId).toBeTruthy();

    const hiddenForRejection = await app.request(
      `/api/v1/admin/content/guestbook/${rejectionPostId}/hide`,
      jsonRequest('admin', { reason: '기각 흐름 숨김 QA' }),
      env,
    );
    expect(hiddenForRejection.status).toBe(200);
    const rejectionAppeal = await app.request(
      `/api/v1/content/guestbook/${rejectionPostId}/appeals`,
      jsonRequest('expired-author', { reason: '기각 결과 저장 검증 요청' }),
      env,
    );
    expect(rejectionAppeal.status).toBe(201);
    const rejectionPayload = (await rejectionAppeal.json()) as {
      appealId: string;
    };
    const rejectedWithoutReason = await app.request(
      `/api/v1/admin/appeals/${rejectionPayload.appealId}/decision`,
      jsonRequest('admin', { decision: 'reject' }),
      env,
    );
    expect(rejectedWithoutReason.status).toBe(400);
    expect(storage.has(rejectionObjectPath ?? '')).toBe(true);

    const rejected = await app.request(
      `/api/v1/admin/appeals/${rejectionPayload.appealId}/decision`,
      jsonRequest('admin', {
        decision: 'reject',
        reason: '기각 사유 합성 테스트 안내입니다.',
      }),
      env,
    );
    expect(rejected.status).toBe(200);
    expect(await rejected.json()).toMatchObject({ decision: 'reject' });
    expect(storage.has(rejectionObjectPath ?? '')).toBe(false);
    const removedContent = await adminPool.query(
      `select id from guestbook_posts where id = $1
       union all
       select id from community_media where guestbook_post_id = $1`,
      [rejectionPostId],
    );
    expect(removedContent.rowCount).toBe(0);
    const rejectionResult = await adminPool.query<{
      decision_reason: string;
      expires_at: Date;
    }>(
      `select decision_reason, expires_at from content_appeal_results
       where author_id = $1 and decision_reason = $2`,
      [expiredAuthorId, '기각 사유 합성 테스트 안내입니다.'],
    );
    expect(rejectionResult.rows[0]?.decision_reason).toBe(
      '기각 사유 합성 테스트 안내입니다.',
    );
    expect(rejectionResult.rows[0]?.expires_at.getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000,
    );
    const myResultResponse = await app.request(
      '/api/v1/me/content',
      { headers: { Cookie: 'session=expired-author' } },
      env,
    );
    const myResultPayload = (await myResultResponse.json()) as {
      posts: Array<{ id: string }>;
      appealResults: Array<{ decision_reason: string }>;
    };
    expect(
      myResultPayload.posts.some((post) => post.id === rejectionPostId),
    ).toBe(false);
    expect(myResultPayload.appealResults).toContainEqual(
      expect.objectContaining({
        decision_reason: '기각 사유 합성 테스트 안내입니다.',
      }),
    );

    const expiredAppeal = await app.request(
      `/api/v1/content/guestbook/${expiredPostId}/appeals`,
      jsonRequest('expired-author', { reason: '기한 이후 신청 시도입니다.' }),
      env,
    );
    expect(expiredAppeal.status).toBe(410);
    expect(await expiredAppeal.json()).toMatchObject({
      code: 'APPEAL_WINDOW_EXPIRED',
    });

    await adminPool.query(
      `update content_appeal_results
       set expires_at = now() - interval '1 second'
       where author_id = $1
         and decision_reason = '기각 사유 합성 테스트 안내입니다.'`,
      [expiredAuthorId],
    );
    const purge = await purgeExpiredCommunityContent(
      adminPool,
      env.MEDIA_BUCKET,
    );
    expect(purge).toEqual({
      purged: 1,
      waitingForAppeal: 1,
      failed: 0,
      appealResultsRemoved: 1,
    });
    const expiredDeleted = await adminPool.query(
      'select id from guestbook_posts where id = $1',
      [expiredPostId],
    );
    expect(expiredDeleted.rowCount).toBe(0);
    const pendingPreserved = await adminPool.query<{ status: string }>(
      'select status from guestbook_posts where id = $1',
      [createdPostIds[3]],
    );
    expect(pendingPreserved.rows[0]?.status).toBe('hidden');
    const expiredNoticeRemoved = await adminPool.query(
      `select id from content_appeal_results
       where author_id = $1 and decision_reason = $2`,
      [expiredAuthorId, '기각 사유 합성 테스트 안내입니다.'],
    );
    expect(expiredNoticeRemoved.rowCount).toBe(0);
  });
});
