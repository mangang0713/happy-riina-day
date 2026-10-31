// 실제 OAuth provider에 접속하지 않고 Better Auth가 만드는 승인 URL과 scope를 검사합니다.
import { describe, expect, it } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import type { Pool } from 'pg';
import { createAuthOptions } from './auth';
import type { WorkerEnv } from './env';

const appOrigin = 'https://archive.example.test';
const authEnvironment = {
  ASSETS: { fetch: async () => new Response('') },
  HYPERDRIVE: { connectionString: 'postgres://oauth-test.invalid/local' },
  MEDIA_BUCKET: { delete: async () => undefined },
  BETTER_AUTH_SECRET: 'oauth-flow-test-secret-with-at-least-32-characters',
  BETTER_AUTH_URL: appOrigin,
  APP_ORIGIN: appOrigin,
  GOOGLE_CLIENT_ID: 'google-test-client-id',
  GOOGLE_CLIENT_SECRET: 'google-test-client-secret',
  TWITTER_CLIENT_ID: 'x-test-client-id',
  TWITTER_CLIENT_SECRET: 'x-test-client-secret',
  KAKAO_CLIENT_ID: 'kakao-test-client-id',
  KAKAO_CLIENT_SECRET: 'kakao-test-client-secret',
} as unknown as WorkerEnv;

async function createAuthorizationUrl(
  provider: 'google' | 'twitter' | 'kakao',
) {
  const testAuth = betterAuth({
    ...createAuthOptions(authEnvironment, {} as Pool),
    database: memoryAdapter({}),
  });
  const response = await testAuth.api.signInSocial({
    body: {
      provider,
      callbackURL: `${appOrigin}/account`,
      disableRedirect: true,
    },
  });
  if (!response.url) {
    throw new Error('OAuth authorization URL was not returned.');
  }
  return new URL(response.url);
}

describe('Better Auth provider authorization URLs', () => {
  it.each([
    ['google', 'google-test-client-id'],
    ['twitter', 'x-test-client-id'],
    ['kakao', 'kakao-test-client-id'],
  ] as const)(
    'uses the same-origin callback for %s without contacting the provider',
    async (provider, clientId) => {
      const authorizationUrl = await createAuthorizationUrl(provider);
      expect(authorizationUrl.searchParams.get('client_id')).toBe(clientId);
      expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
        `${appOrigin}/api/auth/callback/${provider}`,
      );
      expect(authorizationUrl.searchParams.get('state')).toBeTruthy();
    },
  );

  it('requests identity-only X scopes', async () => {
    const authorizationUrl = await createAuthorizationUrl('twitter');
    const scopes = authorizationUrl.searchParams.get('scope')?.split(' ') ?? [];

    expect(scopes).toEqual(['users.read']);
    expect(scopes).not.toContain('tweet.read');
    expect(scopes).not.toContain('email');
    expect(scopes).not.toContain('offline.access');
  });
});
