// 공개 본인 글 삭제의 소유권, 숨김 보존, 저장소 실패와 사용량 정산 경계를 검사합니다.
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { createWorkerApp } from './index';
import type { WorkerEnv } from './env';

const contentId = 'a8c1534a-99b2-48fd-8f6f-72be5cb030de';
const authorId = 'qa-author-id';

function createDeleteTestApp(options?: {
  status?: string;
  contentType?: 'guestbook' | 'review';
  signedInUserId?: string | null;
  rateLimited?: boolean;
  failStorage?: boolean;
  withMedia?: boolean;
  withReservation?: boolean;
}) {
  const statementLog: Array<{ sql: string; values?: unknown[] }> = [];
  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    statementLog.push({ sql, values });
    if (sql.includes('insert into community_rate_limits')) {
      return { rows: options?.rateLimited ? [] : [{ request_count: 1 }] };
    }
    return { rows: [], rowCount: 1 };
  });
  const clientQuery = vi.fn(async (sql: string, values: unknown[] = []) => {
    statementLog.push({ sql, values });
    if (
      sql.includes(
        `from ${options?.contentType === 'review' ? 'schedule_reviews' : 'guestbook_posts'}`,
      ) &&
      sql.includes('for update')
    ) {
      return {
        rows:
          options?.status === 'missing'
            ? []
            : [
                {
                  id: contentId,
                  user_id: authorId,
                  author_name: 'QA 작성자',
                  body: '삭제 확인용 QA 글입니다.',
                  status: options?.status ?? 'published',
                  created_at: new Date('2026-10-30T10:00:00.000Z'),
                  hidden_at: null,
                  purge_after: null,
                },
              ],
      };
    }
    if (sql.includes('from community_media') && sql.includes('for update')) {
      return {
        rows: options?.withMedia
          ? [
              {
                id: '3b4c82f6-30df-4f77-90b2-a8c1534a99b2',
                owner_id: authorId,
                object_path: 'community/qa-image.webp',
                byte_size: 4096,
              },
            ]
          : [],
      };
    }
    if (
      sql.includes('from media_quota_reservations') &&
      sql.includes('for update')
    ) {
      return {
        rows: options?.withReservation
          ? [
              {
                id: 'b6b82577-b1b6-44f0-99d2-53d41c3e5984',
                user_id: authorId,
                byte_size: 2048,
                object_path: 'community/pending-qa-image.webp',
              },
            ]
          : [],
      };
    }
    if (
      sql.startsWith(
        `delete from ${options?.contentType === 'review' ? 'schedule_reviews' : 'guestbook_posts'}`,
      )
    ) {
      return {
        rows: [],
        rowCount: options?.status === 'published' || !options?.status ? 1 : 0,
      };
    }
    return { rows: [], rowCount: 1 };
  });
  const database = {
    query,
    connect: vi.fn(async () => ({
      query: clientQuery,
      release: vi.fn(),
    })),
    end: vi.fn(async () => undefined),
  } as unknown as Pool;
  const deleteObject = vi.fn(async () => {
    if (options?.failStorage) throw new Error('R2 unavailable');
  });
  const app = createWorkerApp({
    createDatabase: () => database,
    resolveUserId: async (_env, _database, headers) =>
      headers.get('Cookie') ? options?.signedInUserId ?? authorId : null,
  });
  const env = {
    ASSETS: { fetch: vi.fn() },
    HYPERDRIVE: {},
    MEDIA_BUCKET: { delete: deleteObject },
    BETTER_AUTH_SECRET: '',
    BETTER_AUTH_URL: 'http://localhost:8787',
    APP_ORIGIN: 'http://localhost:8787',
  } as unknown as WorkerEnv;

  return { app, env, deleteObject, query, clientQuery, statementLog };
}

describe('author content deletion route', () => {
  it('deletes only the author’s published content and settles photo quotas', async () => {
    const test = createDeleteTestApp({
      withMedia: true,
      withReservation: true,
    });
    const response = await test.app.request(
      `/api/v1/content/guestbook/${contentId}`,
      { method: 'DELETE', headers: { Cookie: 'session=qa' } },
      test.env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(test.deleteObject).toHaveBeenCalledTimes(2);
    expect(test.deleteObject).toHaveBeenCalledWith('community/qa-image.webp');
    expect(test.deleteObject).toHaveBeenCalledWith(
      'community/pending-qa-image.webp',
    );
    expect(
      test.statementLog.some(({ sql }) => sql.includes('content_reports')),
    ).toBe(true);
    expect(
      test.statementLog.some(({ sql }) => sql.includes('content_appeals')),
    ).toBe(true);
  });

  it('supports deleting the author’s own published schedule review', async () => {
    const test = createDeleteTestApp({ contentType: 'review' });
    const response = await test.app.request(
      `/api/v1/content/review/${contentId}`,
      { method: 'DELETE', headers: { Cookie: 'session=qa' } },
      test.env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(
      test.statementLog.some(({ sql }) =>
        sql.startsWith('delete from schedule_reviews'),
      ),
    ).toBe(true);
  });

  it('rejects anonymous, non-owner, and under-review deletion requests', async () => {
    const anonymous = createDeleteTestApp();
    const anonymousResponse = await anonymous.app.request(
      `/api/v1/content/guestbook/${contentId}`,
      { method: 'DELETE' },
      anonymous.env,
    );
    expect(anonymousResponse.status).toBe(401);

    const otherAuthor = createDeleteTestApp({
      signedInUserId: 'different-user-id',
    });
    const forbiddenResponse = await otherAuthor.app.request(
      `/api/v1/content/guestbook/${contentId}`,
      { method: 'DELETE', headers: { Cookie: 'session=qa' } },
      otherAuthor.env,
    );
    expect(forbiddenResponse.status).toBe(403);

    const hidden = createDeleteTestApp({ status: 'hidden' });
    const hiddenResponse = await hidden.app.request(
      `/api/v1/content/guestbook/${contentId}`,
      { method: 'DELETE', headers: { Cookie: 'session=qa' } },
      hidden.env,
    );
    expect(hiddenResponse.status).toBe(409);
  });

  it('preserves database rows if private image storage rejects a delete', async () => {
    const test = createDeleteTestApp({ withMedia: true, failStorage: true });
    const response = await test.app.request(
      `/api/v1/content/guestbook/${contentId}`,
      { method: 'DELETE', headers: { Cookie: 'session=qa' } },
      test.env,
    );

    expect(response.status).toBe(503);
    expect(test.clientQuery).toHaveBeenCalledWith('rollback');
    expect(
      test.statementLog.some(({ sql }) =>
        sql.startsWith('delete from guestbook_posts'),
      ),
    ).toBe(false);
  });

  it('limits repeated deletion attempts', async () => {
    const test = createDeleteTestApp({ rateLimited: true });
    const response = await test.app.request(
      `/api/v1/content/guestbook/${contentId}`,
      { method: 'DELETE', headers: { Cookie: 'session=qa' } },
      test.env,
    );

    expect(response.status).toBe(429);
    expect(test.clientQuery).not.toHaveBeenCalled();
  });
});
