// 외부 서비스 대신 가짜 DB·세션·Turnstile을 주입해 Worker HTTP 계약을 검사합니다.
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { SOCIAL_PROVIDER_SCOPES } from './auth';
import { app, createWorkerApp } from './index';
import type { WorkerEnv } from './env';
import { verifyTurnstile } from './turnstile';

function createTestEnv(overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    HYPERDRIVE: {} as Hyperdrive,
    MEDIA_BUCKET: {} as R2Bucket,
    BETTER_AUTH_SECRET: '',
    BETTER_AUTH_URL: 'http://localhost:8787',
    APP_ORIGIN: 'http://localhost:8787',
    ...overrides,
  };
}

describe('Worker public routes', () => {
  it('reports health without touching external services', async () => {
    const response = await app.request('/health', undefined, createTestEnv());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('lists only social providers with both credentials configured', async () => {
    const response = await app.request(
      '/api/v1/providers',
      undefined,
      createTestEnv({
        GOOGLE_CLIENT_ID: 'local-client-id',
        GOOGLE_CLIENT_SECRET: 'local-client-secret',
        TWITTER_CLIENT_ID: 'local-x-client-id',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ providers: ['google'] });
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const response = await app.request(
      '/api/v1/unknown',
      undefined,
      createTestEnv(),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: 'NOT_FOUND',
      error: '요청한 API를 찾을 수 없습니다.',
    });
  });

  it('serves unknown page routes from the static SPA assets binding', async () => {
    const fetchAsset = vi.fn(async () => new Response('<main>archive</main>'));
    const response = await app.request(
      '/archive',
      undefined,
      createTestEnv({ ASSETS: { fetch: fetchAsset } as unknown as Fetcher }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<main>archive</main>');
    expect(fetchAsset).toHaveBeenCalledOnce();
  });
});

describe('social login data minimization', () => {
  it('does not request X posts, email, or offline access', () => {
    expect(SOCIAL_PROVIDER_SCOPES.x).toEqual(['users.read']);
    expect(SOCIAL_PROVIDER_SCOPES.x).not.toContain('tweet.read');
    expect(SOCIAL_PROVIDER_SCOPES.x).not.toContain('users.email');
    expect(SOCIAL_PROVIDER_SCOPES.x).not.toContain('offline.access');
  });

  it('does not request Kakao email or unrelated account data', () => {
    expect(SOCIAL_PROVIDER_SCOPES.kakao).toEqual([
      'profile_nickname',
      'profile_image',
    ]);
    expect(SOCIAL_PROVIDER_SCOPES.kakao).not.toContain('account_email');
  });
});

const testPostId = 'd1b2cf78-9486-47e2-8f1d-63d3c5c8e117';
const testReviewId = 'f31645f8-2e31-4d1d-a944-8935dd0ddf7c';

function createCommunityTestApp(options?: {
  signedInUserId?: string | null;
  termsVersion?: string | null;
  turnstileResult?: 'verified' | 'rejected' | 'unavailable';
}) {
  const posts = new Map<
    string,
    { userId: string; body: string; status: string }
  >();
  const reviews = new Map<
    string,
    { scheduleId: string; userId: string; body: string; rating: number }
  >();
  const likes = new Set<string>();
  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    if (sql.includes('select settings.community_enabled')) {
      return { rows: [{ community_enabled: true, database_bytes: '1024' }] };
    }
    if (sql.includes('select community_terms_version from profiles')) {
      return {
        rows:
          options?.termsVersion === null
            ? []
            : [
                {
                  community_terms_version:
                    options?.termsVersion ?? '2026-10-21-v2',
                },
              ],
      };
    }
    if (sql.includes('insert into community_rate_limits')) {
      return { rows: [{ request_count: 1 }] };
    }
    if (sql.includes('select display_name from profiles')) {
      return { rows: [{ display_name: '테스트 팬' }] };
    }
    if (sql.includes('insert into guestbook_posts')) {
      posts.set(testPostId, {
        userId: String(values[0]),
        body: String(values[2]),
        status: 'published',
      });
      return { rows: [{ id: testPostId }] };
    }
    if (sql.includes('update guestbook_posts')) {
      const post = posts.get(String(values[0]));
      if (!post || post.userId !== values[1] || post.status !== 'published') {
        return { rows: [] };
      }
      post.body = String(values[2]);
      return { rows: [{ id: String(values[0]) }] };
    }
    if (sql.includes('insert into schedule_reviews')) {
      const key = `${values[0]}:${values[1]}`;
      if (
        [...reviews.values()].some(
          (review) => `${review.scheduleId}:${review.userId}` === key,
        )
      ) {
        return { rows: [] };
      }
      reviews.set(testReviewId, {
        scheduleId: String(values[0]),
        userId: String(values[1]),
        body: String(values[3]),
        rating: Number(values[4]),
      });
      return { rows: [{ id: testReviewId }] };
    }
    if (sql.includes('update schedule_reviews')) {
      const review = reviews.get(String(values[0]));
      if (
        !review ||
        review.scheduleId !== values[1] ||
        review.userId !== values[2]
      ) {
        return { rows: [] };
      }
      review.body = String(values[3]);
      review.rating = Number(values[4]);
      return { rows: [{ id: String(values[0]) }] };
    }
    if (sql.includes('select pg_advisory_xact_lock')) {
      return { rows: [] };
    }
    if (sql.includes('delete from schedule_likes')) {
      const key = `${values[0]}:${values[1]}`;
      if (!likes.has(key)) return { rows: [] };
      likes.delete(key);
      return { rows: [{ id: 'like-row' }] };
    }
    if (sql.includes('insert into schedule_likes')) {
      const key = `${values[0]}:${values[1]}`;
      if (likes.has(key)) return { rows: [] };
      likes.add(key);
      return { rows: [{ id: 'like-row' }] };
    }
    if (sql.includes('select id from schedule_likes')) {
      const key = `${values[0]}:${values[1]}`;
      return { rows: likes.has(key) ? [{ id: 'like-row' }] : [] };
    }
    return { rows: [] };
  });
  const database = {
    query,
    connect: vi.fn(async () => ({ query, release: vi.fn() })),
    end: vi.fn(async () => undefined),
  } as unknown as Pool;
  const verifyBot = vi.fn(async () => options?.turnstileResult ?? 'verified');
  const testApp = createWorkerApp({
    createDatabase: () => database,
    resolveUserId: async (_env, _database, headers) => {
      if (options && 'signedInUserId' in options) {
        return options.signedInUserId ?? null;
      }
      return headers.get('Cookie')?.match(/session=([^;]+)/)?.[1] ?? null;
    },
    verifyTurnstile: verifyBot,
  });
  const env = createTestEnv();

  return { testApp, env, posts, reviews, likes, query, verifyBot };
}

describe('Turnstile Siteverify boundary', () => {
  const env = createTestEnv({
    APP_ORIGIN: 'https://happy-riina-day.example',
    TURNSTILE_SECRET_KEY: 'local-only-test-secret',
  });

  it('accepts only a successful response for the configured hostname', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ success: true, hostname: 'happy-riina-day.example' }),
    );

    await expect(verifyTurnstile(env, 'test-token', fetcher)).resolves.toBe(
      'verified',
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects missing tokens and Siteverify rejection or hostname mismatch', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ success: true, hostname: 'attacker.example' }),
    );
    await expect(verifyTurnstile(env, undefined, fetcher)).resolves.toBe(
      'rejected',
    );
    await expect(verifyTurnstile(env, 'bad-token', fetcher)).resolves.toBe(
      'rejected',
    );
    await expect(
      verifyTurnstile(env, 'bad-token', async () =>
        Response.json({ success: false }),
      ),
    ).resolves.toBe('rejected');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('fails closed when credentials or Cloudflare are unavailable', async () => {
    await expect(
      verifyTurnstile(createTestEnv(), 'test-token', vi.fn()),
    ).resolves.toBe('unavailable');
    await expect(
      verifyTurnstile(env, 'test-token', async () => {
        throw new Error('network unavailable');
      }),
    ).resolves.toBe('unavailable');
    await expect(
      verifyTurnstile(env, 'test-token', async () =>
        Response.json({ success: 'yes' }),
      ),
    ).resolves.toBe('unavailable');
    await expect(
      verifyTurnstile(
        env,
        'test-token',
        async () => new Response('upstream failure', { status: 502 }),
      ),
    ).resolves.toBe('unavailable');
    await expect(
      verifyTurnstile(
        env,
        'test-token',
        async () => new Response('invalid JSON', { status: 200 }),
      ),
    ).resolves.toBe('unavailable');
  });
});

describe('guestbook write routes', () => {
  function request(
    testApp: ReturnType<typeof createCommunityTestApp>['testApp'],
    path: string,
    body: Record<string, unknown>,
    userId = 'writer-1',
  ) {
    return testApp.request(
      path,
      {
        method:
          path.endsWith('/guestbook') ||
          path.endsWith('/reviews') ||
          path.endsWith('/like')
            ? 'POST'
            : 'PUT',
        headers: {
          Cookie: `session=${userId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      createTestEnv(),
    );
  }

  it('creates and edits only a published post owned by the session user', async () => {
    const { testApp, posts } = createCommunityTestApp();
    const created = await request(testApp, '/api/v1/guestbook', {
      body: '처음 작성한 글입니다.',
      turnstileToken: 'verified-token',
    });

    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ id: testPostId });
    expect(posts.get(testPostId)).toMatchObject({
      userId: 'writer-1',
      body: '처음 작성한 글입니다.',
      status: 'published',
    });

    const edited = await request(testApp, `/api/v1/guestbook/${testPostId}`, {
      body: '수정한 글입니다.',
      turnstileToken: 'verified-token',
    });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toEqual({ id: testPostId });
    expect(posts.get(testPostId)?.body).toBe('수정한 글입니다.');

    const forbiddenEdit = await request(
      testApp,
      `/api/v1/guestbook/${testPostId}`,
      { body: '다른 사람의 글 수정', turnstileToken: 'verified-token' },
      'writer-2',
    );
    expect(forbiddenEdit.status).toBe(403);
    expect(await forbiddenEdit.json()).toMatchObject({
      code: 'CONTENT_NOT_EDITABLE',
    });
    expect(posts.get(testPostId)?.body).toBe('수정한 글입니다.');
  });

  it('creates one review per user and toggles likes atomically', async () => {
    const { testApp, reviews, likes } = createCommunityTestApp();
    const reviewPath = '/api/v1/schedules/schedule-test/reviews';
    const created = await request(testApp, reviewPath, {
      body: '이 일정의 공연이 정말 좋았습니다.',
      rating: 5,
      turnstileToken: 'verified-token',
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ id: testReviewId });
    expect(reviews.get(testReviewId)).toMatchObject({
      scheduleId: 'schedule-test',
      userId: 'writer-1',
      body: '이 일정의 공연이 정말 좋았습니다.',
      rating: 5,
    });

    const duplicate = await request(testApp, reviewPath, {
      body: '중복으로 쓰려는 후기입니다.',
      rating: 4,
      turnstileToken: 'verified-token',
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({
      code: 'REVIEW_ALREADY_EXISTS',
    });

    const updated = await request(testApp, `${reviewPath}/${testReviewId}`, {
      body: '수정된 후기입니다.',
      rating: 4,
      turnstileToken: 'verified-token',
    });
    expect(updated.status).toBe(200);
    expect(reviews.get(testReviewId)).toMatchObject({
      body: '수정된 후기입니다.',
      rating: 4,
    });

    const forbidden = await request(
      testApp,
      `${reviewPath}/${testReviewId}`,
      {
        body: '다른 사용자 수정 시도',
        rating: 2,
        turnstileToken: 'verified-token',
      },
      'writer-2',
    );
    expect(forbidden.status).toBe(403);
    expect(reviews.get(testReviewId)?.body).toBe('수정된 후기입니다.');

    const likePath = '/api/v1/schedules/schedule-test/like';
    const liked = await request(testApp, likePath, {});
    expect(liked.status).toBe(200);
    expect(await liked.json()).toEqual({ liked: true });
    expect(likes.has('schedule-test:writer-1')).toBe(true);

    const unliked = await request(testApp, likePath, {});
    expect(unliked.status).toBe(200);
    expect(await unliked.json()).toEqual({ liked: false });
    expect(likes.has('schedule-test:writer-1')).toBe(false);
  });

  it('does not write when signed out, terms are missing, or Turnstile rejects', async () => {
    const signedOut = createCommunityTestApp({ signedInUserId: null });
    const signedOutResponse = await request(
      signedOut.testApp,
      '/api/v1/guestbook',
      { body: '로그아웃 상태 글', turnstileToken: 'verified-token' },
    );
    expect(signedOutResponse.status).toBe(401);
    expect(signedOut.posts.size).toBe(0);

    const termsMissing = createCommunityTestApp({ termsVersion: null });
    const termsResponse = await request(
      termsMissing.testApp,
      '/api/v1/guestbook',
      { body: '동의가 없는 글', turnstileToken: 'verified-token' },
    );
    expect(termsResponse.status).toBe(403);
    expect(await termsResponse.json()).toMatchObject({
      code: 'COMMUNITY_TERMS_REQUIRED',
    });
    expect(termsMissing.posts.size).toBe(0);

    const botRejected = createCommunityTestApp({ turnstileResult: 'rejected' });
    const botResponse = await request(
      botRejected.testApp,
      '/api/v1/guestbook',
      { body: '봇 검증이 거부한 글', turnstileToken: 'invalid-token' },
    );
    expect(botResponse.status).toBe(403);
    expect(await botResponse.json()).toMatchObject({
      code: 'BOT_CHECK_FAILED',
    });
    expect(botRejected.posts.size).toBe(0);
  });

  it('returns stable input, rate-limit, and service errors', async () => {
    const { testApp, posts, query } = createCommunityTestApp();
    const invalidBody = await request(testApp, '/api/v1/guestbook', {
      body: 'x',
      turnstileToken: 'verified-token',
    });
    expect(invalidBody.status).toBe(400);
    expect(await invalidBody.json()).toMatchObject({ code: 'INVALID_INPUT' });
    expect(posts.size).toBe(0);

    const disabled = createCommunityTestApp({ turnstileResult: 'unavailable' });
    const unavailable = await request(disabled.testApp, '/api/v1/guestbook', {
      body: '검증 서비스 장애 글',
      turnstileToken: 'test-token',
    });
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      code: 'BOT_CHECK_UNAVAILABLE',
    });

    query.mockImplementation(async (sql: string) => {
      if (sql.includes('select settings.community_enabled')) {
        return { rows: [{ community_enabled: true, database_bytes: '1024' }] };
      }
      if (sql.includes('select community_terms_version from profiles')) {
        return { rows: [{ community_terms_version: '2026-10-21-v2' }] };
      }
      if (sql.includes('insert into community_rate_limits')) {
        return { rows: [] };
      }
      return { rows: [] };
    });
    const rateLimited = await request(testApp, '/api/v1/guestbook', {
      body: '요청 제한을 초과한 글',
      turnstileToken: 'verified-token',
    });
    expect(rateLimited.status).toBe(429);
    expect(await rateLimited.json()).toMatchObject({ code: 'RATE_LIMITED' });
    expect(posts.size).toBe(0);

    const databaseFailure = createCommunityTestApp();
    databaseFailure.query.mockRejectedValue(
      new Error('local database offline'),
    );
    const unavailableDatabase = await request(
      databaseFailure.testApp,
      '/api/v1/guestbook',
      { body: '데이터베이스 장애 요청', turnstileToken: 'verified-token' },
    );
    expect(unavailableDatabase.status).toBe(503);
    expect(await unavailableDatabase.json()).toMatchObject({
      code: 'DATABASE_UNAVAILABLE',
    });
  });
});
