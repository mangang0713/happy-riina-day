// 공개 설정 경로는 작성 가능 여부만 보여주고 내부 사용량을 노출하지 않습니다.
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { createWorkerApp } from './index';
import type { WorkerEnv } from './env';

describe('public community settings route', () => {
  it('returns only public availability switches', async () => {
    const database = {
      query: async () => ({
        rows: [
          {
            community_enabled: true,
            uploads_enabled: false,
            media_views_enabled: true,
          },
        ],
      }),
      end: async () => undefined,
    } as unknown as Pool;
    const app = createWorkerApp({ createDatabase: () => database });
    const env = {
      ASSETS: { fetch: vi.fn() },
      HYPERDRIVE: {},
      MEDIA_BUCKET: {},
      BETTER_AUTH_SECRET: '',
      BETTER_AUTH_URL: 'http://localhost:8787',
      APP_ORIGIN: 'http://localhost:8787',
    } as unknown as WorkerEnv;

    const response = await app.request('/api/v1/settings', {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      community_enabled: true,
      uploads_enabled: false,
      media_views_enabled: true,
    });
  });
});
