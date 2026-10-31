// 전용 로컬 PostgreSQL에서 방명록 작성·수정과 권한·제한 동작을 확인합니다.
// WORKER_TEST_DATABASE_URL이 없으면 통합 검사만 안전하게 건너뜁니다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createWorkerApp } from './index';
import type { WorkerEnv } from './env';

const connectionString = process.env.WORKER_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration('guestbook API with local PostgreSQL', () => {
  const writerId = `worker-qa-writer-${crypto.randomUUID()}`;
  const otherId = `worker-qa-other-${crypto.randomUUID()}`;
  const testUsers = new Map([
    ['writer', writerId],
    ['other', otherId],
  ]);
  const createdPostIds: string[] = [];
  const createdReviewIds: string[] = [];
  const storedObjects = new Map<string, Uint8Array>();
  const adminPool = new Pool({ connectionString });
  const app = createWorkerApp({
    createDatabase: (env) =>
      new Pool({ connectionString: env.HYPERDRIVE.connectionString }),
    resolveUserId: async (_env, _database, headers) => {
      const key = headers.get('Cookie')?.match(/session=([^;]+)/)?.[1];
      return key ? testUsers.get(key) ?? null : null;
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
        storedObjects.set(key, bytes.slice());
        return {};
      },
      get: async (key: string) => {
        const bytes = storedObjects.get(key);
        if (!bytes) return null;
        return {
          body: new Blob([bytes.slice().buffer]).stream(),
          httpEtag: '"local-media-etag"',
        } as unknown as R2ObjectBody;
      },
      delete: async (key: string) => {
        storedObjects.delete(key);
      },
    } as unknown as R2Bucket,
    BETTER_AUTH_SECRET: 'local-integration-only-secret-000000000000',
    BETTER_AUTH_URL: 'http://127.0.0.1:8791',
    APP_ORIGIN: 'http://127.0.0.1:8791',
  } as unknown as WorkerEnv;

  beforeAll(async () => {
    await adminPool.query(
      `
        insert into "user" (id, name, email)
        values ($1, 'Local QA Writer', $2), ($3, 'Local QA Other', $4)
      `,
      [
        writerId,
        `${writerId}@accounts.invalid`,
        otherId,
        `${otherId}@accounts.invalid`,
      ],
    );
    await adminPool.query(
      `
        insert into profiles (id, display_name, community_terms_version)
        values ($1, '로컬 QA 작성자', '2026-10-21-v2'),
               ($2, '로컬 QA 다른 사용자', '2026-10-21-v2')
      `,
      [writerId, otherId],
    );
  });

  afterAll(async () => {
    try {
      const media = await adminPool.query<{ bytes: string }>(
        `select coalesce(sum(byte_size), 0)::text as bytes
         from community_media where owner_id = any($1::text[])`,
        [[writerId, otherId]],
      );
      const reservations = await adminPool.query<{ bytes: string }>(
        `select coalesce(sum(byte_size), 0)::text as bytes
         from media_quota_reservations where user_id = any($1::text[])`,
        [[writerId, otherId]],
      );
      if (createdPostIds.length) {
        await adminPool.query(
          'delete from guestbook_posts where id = any($1::uuid[])',
          [createdPostIds],
        );
      }
      if (createdReviewIds.length) {
        await adminPool.query(
          'delete from schedule_reviews where id = any($1::uuid[])',
          [createdReviewIds],
        );
      }
      await adminPool.query(
        'delete from community_media where owner_id = any($1::text[])',
        [[writerId, otherId]],
      );
      await adminPool.query(
        'delete from media_quota_reservations where user_id = any($1::text[])',
        [[writerId, otherId]],
      );
      await adminPool.query(
        `update community_settings
         set storage_used_bytes = greatest(0, storage_used_bytes - $1),
             storage_reserved_bytes = greatest(0, storage_reserved_bytes - $2),
             updated_at = now()
         where id = true`,
        [media.rows[0]?.bytes ?? '0', reservations.rows[0]?.bytes ?? '0'],
      );
      await adminPool.query('delete from "user" where id = any($1::text[])', [
        [writerId, otherId],
      ]);
      storedObjects.clear();
    } finally {
      await adminPool.end();
    }
  });

  it('creates, edits, and protects ownership in the local database', async () => {
    const created = await app.request(
      '/api/v1/guestbook',
      {
        method: 'POST',
        headers: {
          Cookie: 'session=writer',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: '격리된 PostgreSQL 작성 테스트입니다.',
          turnstileToken: 'local-mocked-turnstile-token',
        }),
      },
      env,
    );
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as { id: string };
    createdPostIds.push(createdPayload.id);

    const row = await adminPool.query<{
      author_name: string;
      body: string;
      status: string;
      user_id: string;
    }>(
      'select author_name, body, status, user_id from guestbook_posts where id = $1',
      [createdPayload.id],
    );
    expect(row.rows[0]).toMatchObject({
      author_name: '로컬 QA 작성자',
      body: '격리된 PostgreSQL 작성 테스트입니다.',
      status: 'published',
      user_id: writerId,
    });

    const editPath = `/api/v1/guestbook/${createdPayload.id}`;
    const edited = await app.request(
      editPath,
      {
        method: 'PUT',
        headers: {
          Cookie: 'session=writer',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: '로컬 PostgreSQL에서 수정까지 확인했습니다.',
          turnstileToken: 'local-mocked-turnstile-token',
        }),
      },
      env,
    );
    expect(edited.status).toBe(200);

    const forbidden = await app.request(
      editPath,
      {
        method: 'PUT',
        headers: {
          Cookie: 'session=other',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: '다른 계정 수정 시도',
          turnstileToken: 'local-mocked-turnstile-token',
        }),
      },
      env,
    );
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({
      code: 'CONTENT_NOT_EDITABLE',
    });

    const unchanged = await adminPool.query<{ body: string }>(
      'select body from guestbook_posts where id = $1',
      [createdPayload.id],
    );
    expect(unchanged.rows[0]?.body).toBe(
      '로컬 PostgreSQL에서 수정까지 확인했습니다.',
    );

    const reviewPath = '/api/v1/schedules/local-qa-schedule/reviews';
    const review = await app.request(
      reviewPath,
      {
        method: 'POST',
        headers: {
          Cookie: 'session=writer',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: '로컬 PostgreSQL 후기 쓰기 검사입니다.',
          rating: 5,
          turnstileToken: 'local-mocked-turnstile-token',
        }),
      },
      env,
    );
    expect(review.status).toBe(201);
    const createdReview = (await review.json()) as { id: string };
    createdReviewIds.push(createdReview.id);

    const duplicateReview = await app.request(
      reviewPath,
      {
        method: 'POST',
        headers: {
          Cookie: 'session=writer',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: '같은 계정의 두 번째 후기입니다.',
          rating: 4,
          turnstileToken: 'local-mocked-turnstile-token',
        }),
      },
      env,
    );
    expect(duplicateReview.status).toBe(409);

    const updatedReview = await app.request(
      `${reviewPath}/${createdReview.id}`,
      {
        method: 'PUT',
        headers: {
          Cookie: 'session=writer',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: '로컬 PostgreSQL 후기 수정 검사입니다.',
          rating: 4,
          turnstileToken: 'local-mocked-turnstile-token',
        }),
      },
      env,
    );
    expect(updatedReview.status).toBe(200);

    const reviewRow = await adminPool.query<{
      body: string;
      rating: number;
      user_id: string;
    }>('select body, rating, user_id from schedule_reviews where id = $1', [
      createdReview.id,
    ]);
    expect(reviewRow.rows[0]).toMatchObject({
      body: '로컬 PostgreSQL 후기 수정 검사입니다.',
      rating: 4,
      user_id: writerId,
    });

    const likePath = '/api/v1/schedules/local-qa-schedule/like';
    for (const [expectedStatus, expectedLiked] of [
      [200, true],
      [200, false],
    ] as const) {
      const likeResponse = await app.request(
        likePath,
        {
          method: 'POST',
          headers: { Cookie: 'session=writer' },
        },
        env,
      );
      expect(likeResponse.status).toBe(expectedStatus);
      expect(await likeResponse.json()).toEqual({ liked: expectedLiked });
    }
    const remainingLikes = await adminPool.query<{ count: string }>(
      'select count(*)::text as count from schedule_likes where schedule_id = $1 and user_id = $2',
      ['local-qa-schedule', writerId],
    );
    expect(remainingLikes.rows[0]?.count).toBe('0');

    const invalidImageForm = new FormData();
    invalidImageForm.set('parentType', 'guestbook');
    invalidImageForm.set('parentId', createdPayload.id);
    invalidImageForm.set('turnstileToken', 'local-mocked-turnstile-token');
    invalidImageForm.set(
      'file',
      new File(['not an image'], 'fake.webp', { type: 'image/webp' }),
    );
    const invalidImage = await app.request(
      '/api/v1/media',
      {
        method: 'POST',
        headers: { Cookie: 'session=writer' },
        body: invalidImageForm,
      },
      env,
    );
    expect(invalidImage.status).toBe(415);
    expect(storedObjects.size).toBe(0);

    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const imageForm = new FormData();
    imageForm.set('parentType', 'guestbook');
    imageForm.set('parentId', createdPayload.id);
    imageForm.set('turnstileToken', 'local-mocked-turnstile-token');
    imageForm.set(
      'file',
      new File([webpBytes.slice().buffer], 'synthetic.webp', {
        type: 'image/webp',
      }),
    );
    const baselineGlobalUsage = await adminPool.query<{
      storage_used_bytes: string;
      storage_reserved_bytes: string;
    }>(
      `select storage_used_bytes::text, storage_reserved_bytes::text
       from community_settings where id = true`,
    );
    const baselineUsed = BigInt(
      baselineGlobalUsage.rows[0]?.storage_used_bytes ?? '0',
    );
    const baselineReserved = BigInt(
      baselineGlobalUsage.rows[0]?.storage_reserved_bytes ?? '0',
    );
    const uploaded = await app.request(
      '/api/v1/media',
      {
        method: 'POST',
        headers: { Cookie: 'session=writer' },
        body: imageForm,
      },
      env,
    );
    expect(uploaded.status).toBe(201);
    const uploadedPayload = (await uploaded.json()) as { mediaId: string };
    const mediaRow = await adminPool.query<{
      id: string;
      object_path: string;
      byte_size: number;
      content_type: string;
    }>(
      `select id, object_path, byte_size, content_type
       from community_media where id = $1`,
      [uploadedPayload.mediaId],
    );
    expect(mediaRow.rows[0]).toMatchObject({
      id: uploadedPayload.mediaId,
      byte_size: webpBytes.byteLength,
      content_type: 'image/webp',
    });
    const objectPath = mediaRow.rows[0]?.object_path;
    expect(objectPath).toBeTruthy();
    expect(storedObjects.get(objectPath ?? '')).toEqual(webpBytes);

    const ownerUsage = await adminPool.query<{
      image_count: number;
      bytes_used: string;
      images_reserved: number;
      bytes_reserved: string;
    }>(
      `select image_count, bytes_used::text, images_reserved, bytes_reserved::text
       from user_media_usage where user_id = $1`,
      [writerId],
    );
    expect(ownerUsage.rows[0]).toMatchObject({
      image_count: 1,
      bytes_used: String(webpBytes.byteLength),
      images_reserved: 0,
      bytes_reserved: '0',
    });
    const globalUsage = await adminPool.query<{
      storage_used_bytes: string;
      storage_reserved_bytes: string;
    }>(
      `select storage_used_bytes::text, storage_reserved_bytes::text
       from community_settings where id = true`,
    );
    expect(globalUsage.rows[0]).toMatchObject({
      storage_used_bytes: String(baselineUsed + BigInt(webpBytes.byteLength)),
      storage_reserved_bytes: String(baselineReserved),
    });

    const readableImage = await app.request(
      `/api/v1/media/${uploadedPayload.mediaId}`,
      { headers: { Cookie: 'session=other' } },
      env,
    );
    expect(readableImage.status).toBe(200);
    expect(new Uint8Array(await readableImage.arrayBuffer())).toEqual(
      webpBytes,
    );

    const forbiddenDelete = await app.request(
      `/api/v1/media/${uploadedPayload.mediaId}`,
      { method: 'DELETE', headers: { Cookie: 'session=other' } },
      env,
    );
    expect(forbiddenDelete.status).toBe(403);
    expect(storedObjects.has(objectPath ?? '')).toBe(true);

    const deletedByOwner = await app.request(
      `/api/v1/media/${uploadedPayload.mediaId}`,
      { method: 'DELETE', headers: { Cookie: 'session=writer' } },
      env,
    );
    expect(deletedByOwner.status).toBe(200);
    expect(await deletedByOwner.json()).toEqual({ deleted: true });
    expect(storedObjects.has(objectPath ?? '')).toBe(false);

    const deletedMediaRow = await adminPool.query(
      'select id from community_media where id = $1',
      [uploadedPayload.mediaId],
    );
    expect(deletedMediaRow.rowCount).toBe(0);
    const clearedUsage = await adminPool.query<{
      image_count: number;
      bytes_used: string;
      images_reserved: number;
      bytes_reserved: string;
    }>(
      `select image_count, bytes_used::text, images_reserved, bytes_reserved::text
       from user_media_usage where user_id = $1`,
      [writerId],
    );
    expect(clearedUsage.rows[0]).toMatchObject({
      image_count: 0,
      bytes_used: '0',
      images_reserved: 0,
      bytes_reserved: '0',
    });
    const clearedGlobalUsage = await adminPool.query<{
      storage_used_bytes: string;
      storage_reserved_bytes: string;
    }>(
      `select storage_used_bytes::text, storage_reserved_bytes::text
       from community_settings where id = true`,
    );
    expect(clearedGlobalUsage.rows[0]).toMatchObject({
      storage_used_bytes: String(baselineUsed),
      storage_reserved_bytes: String(baselineReserved),
    });
  });
});
