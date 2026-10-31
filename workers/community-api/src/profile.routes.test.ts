// 프로필 API의 본인 범위, 닉네임 검증, 요청 제한과 약관 버전을 검사합니다.
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { createWorkerApp } from './index';
import type { WorkerEnv } from './env';

const profile = {
  id: 'qa-user-id',
  display_name: '리이나 팬',
  community_terms_accepted_at: null,
  community_terms_version: null,
};

function createProfileTestApp(options?: { limitReached?: boolean }) {
  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    if (sql.includes('insert into community_rate_limits')) {
      return { rows: options?.limitReached ? [] : [{ request_count: 1 }] };
    }
    if (sql.includes('update profiles') && sql.includes('display_name = $2')) {
      return { rows: [{ id: values[0], display_name: values[1] }] };
    }
    if (sql.includes('community_terms_accepted_at = now()')) {
      return { rows: [{ id: values[0] }] };
    }
    if (sql.includes('from profiles') && sql.includes('where id = $1')) {
      return { rows: [profile] };
    }
    return { rows: [] };
  });
  const database = {
    query,
    end: vi.fn(async () => undefined),
  } as unknown as Pool;

  const app = createWorkerApp({
    createDatabase: () => database,
    resolveUserId: async (_env, _database, headers) =>
      headers.get('Cookie') ? 'qa-user-id' : null,
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

describe('signed-in profile and community consent routes', () => {
  it('returns the signed-in user profile and current consent version', async () => {
    const { app, env } = createProfileTestApp();
    const response = await app.request(
      '/api/v1/me/profile',
      { headers: { Cookie: 'session=qa' } },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(profile);
  });

  it('normalizes and saves the public display name', async () => {
    const { app, env, query } = createProfileTestApp();
    const response = await app.request(
      '/api/v1/me/profile',
      {
        method: 'PATCH',
        headers: {
          Cookie: 'session=qa',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: '  새 이름  ' }),
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'qa-user-id',
      display_name: '새 이름',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('update profiles'),
      ['qa-user-id', '새 이름'],
    );
  });

  it('requires consent to be recorded server-side for the current version', async () => {
    const { app, env, query } = createProfileTestApp();
    const response = await app.request(
      '/api/v1/me/community-terms',
      {
        method: 'POST',
        headers: { Cookie: 'session=qa' },
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accepted: true,
      version: '2026-10-21-v2',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('community_terms_accepted_at = now()'),
      ['qa-user-id', '2026-10-21-v2'],
    );
  });

  it('rejects anonymous requests, invalid names, and excessive profile edits', async () => {
    const anonymous = createProfileTestApp();
    const anonymousResponse = await anonymous.app.request(
      '/api/v1/me/community-terms',
      { method: 'POST' },
      anonymous.env,
    );
    expect(anonymousResponse.status).toBe(401);

    const invalid = createProfileTestApp();
    const invalidResponse = await invalid.app.request(
      '/api/v1/me/profile',
      {
        method: 'PATCH',
        headers: {
          Cookie: 'session=qa',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: '  ' }),
      },
      invalid.env,
    );
    expect(invalidResponse.status).toBe(400);

    const limited = createProfileTestApp({ limitReached: true });
    const limitedResponse = await limited.app.request(
      '/api/v1/me/profile',
      {
        method: 'PATCH',
        headers: {
          Cookie: 'session=qa',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: '새 이름' }),
      },
      limited.env,
    );
    expect(limitedResponse.status).toBe(429);
  });
});
