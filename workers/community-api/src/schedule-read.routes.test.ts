// 일정 반응과 본인 공개 후기 조회가 예상한 최소 응답을 반환하는지 확인합니다.
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { createWorkerApp } from './index';
import type { WorkerEnv } from './env';

const ownReview = {
  id: '5ac35481-c8f9-483c-82db-703860c838fa',
  schedule_id: 'schedule-2026-05-02-01',
  author_name: '현재 이름',
  body: '즐거운 공연이었어요.',
  rating: 5,
  created_at: '2026-05-02T12:00:00.000Z',
  media: [
    {
      id: 'a56f9bf3-56b7-4bb7-bdb6-1fd76c870d71',
      content_type: 'image/webp',
      byte_size: 1024,
      url: '/api/v1/media/a56f9bf3-56b7-4bb7-bdb6-1fd76c870d71',
    },
  ],
};

function createScheduleReadTestApp(options?: {
  signedIn?: boolean;
  liked?: boolean;
  ownReviewId?: string | null;
  reviewExists?: boolean;
}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('select count(*)::text from schedule_likes')) {
      return {
        rows: [
          {
            like_count: '7',
            liked: options?.liked ?? false,
            own_review_id: options?.ownReviewId ?? null,
          },
        ],
      };
    }
    if (sql.includes('from schedule_reviews as review')) {
      return { rows: options?.reviewExists === false ? [] : [ownReview] };
    }
    return { rows: [] };
  });
  const database = {
    query,
    end: vi.fn(async () => undefined),
  } as unknown as Pool;
  const app = createWorkerApp({
    createDatabase: () => database,
    resolveUserId: async () => (options?.signedIn ? 'qa-user-id' : null),
  });
  const env = {
    ASSETS: { fetch: vi.fn() },
    HYPERDRIVE: {},
    MEDIA_BUCKET: {},
    BETTER_AUTH_SECRET: '',
    BETTER_AUTH_URL: 'http://localhost:8787',
    APP_ORIGIN: 'http://localhost:8787',
  } as unknown as WorkerEnv;

  return { app, env, query };
}

describe('schedule reaction and own-review read routes', () => {
  it('returns public like totals and signed-in reaction state', async () => {
    const anonymous = createScheduleReadTestApp();
    const publicResponse = await anonymous.app.request(
      '/api/v1/schedules/schedule-2026-05-02-01/reactions',
      undefined,
      anonymous.env,
    );
    expect(publicResponse.status).toBe(200);
    expect(await publicResponse.json()).toEqual({
      like_count: 7,
      liked: false,
      own_review_id: null,
    });

    const signedIn = createScheduleReadTestApp({
      signedIn: true,
      liked: true,
      ownReviewId: ownReview.id,
    });
    const privateResponse = await signedIn.app.request(
      '/api/v1/schedules/schedule-2026-05-02-01/reactions',
      { headers: { Cookie: 'session=qa' } },
      signedIn.env,
    );
    expect(privateResponse.status).toBe(200);
    expect(await privateResponse.json()).toEqual({
      like_count: 7,
      liked: true,
      own_review_id: ownReview.id,
    });
  });

  it('returns only the signed-in author’s published review with private media route IDs', async () => {
    const { app, env, query } = createScheduleReadTestApp({
      signedIn: true,
    });
    const response = await app.request(
      '/api/v1/schedules/schedule-2026-05-02-01/reviews/own',
      { headers: { Cookie: 'session=qa' } },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ownReview);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("review.status = 'published'"),
      ['schedule-2026-05-02-01', 'qa-user-id'],
    );
  });

  it('returns null when the user has no published review and requires login', async () => {
    const empty = createScheduleReadTestApp({
      signedIn: true,
      reviewExists: false,
    });
    const emptyResponse = await empty.app.request(
      '/api/v1/schedules/schedule-2026-05-02-01/reviews/own',
      { headers: { Cookie: 'session=qa' } },
      empty.env,
    );
    expect(emptyResponse.status).toBe(200);
    expect(await emptyResponse.json()).toBeNull();

    const anonymous = createScheduleReadTestApp();
    const deniedResponse = await anonymous.app.request(
      '/api/v1/schedules/schedule-2026-05-02-01/reviews/own',
      undefined,
      anonymous.env,
    );
    expect(deniedResponse.status).toBe(401);
  });
});
