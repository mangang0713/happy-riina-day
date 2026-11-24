import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Worker administrator setup', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('skips Supabase auto-claim so the Worker admin-status check can run', async () => {
    vi.stubEnv('MODE', 'worker');
    vi.resetModules();

    const { claimHessxlAdmin } = await import('./adminApi');

    await expect(claimHessxlAdmin()).resolves.toBe(false);
  });
});
