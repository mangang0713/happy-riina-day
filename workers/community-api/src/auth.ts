import { betterAuth, type BetterAuthOptions } from 'better-auth';
import type { Pool } from 'pg';
import { anonymizeAccountCommunityData } from './account';
import type { WorkerEnv } from './env';

/** 로그인에 필요한 최소 정보만 요청하도록 provider별 OAuth scope를 고정합니다. */
export const SOCIAL_PROVIDER_SCOPES = {
  // X의 /2/users/me OAuth 2 user-context 명세는 두 scope를 함께 요구합니다.
  x: ['users.read', 'tweet.read'],
  kakao: ['profile_nickname', 'profile_image'],
} as const;

type XUserProfile = {
  data: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
  };
};

/** X의 현재 사용자 정보만 읽고, 실패 원인은 HTTP 상태만 로그에 남깁니다. */
export async function getXUserInfo(accessToken?: string) {
  if (!accessToken) {
    console.error('[auth:x] Profile lookup skipped: access token missing.');
    return null;
  }

  let response: Response;
  try {
    response = await fetch(
      'https://api.x.com/2/users/me?user.fields=profile_image_url,username',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    console.error('[auth:x] Profile lookup failed: network error or timeout.');
    return null;
  }

  if (!response.ok) {
    // 응답 본문에는 계정 정보가 포함될 수 있어 상태 코드만 기록합니다.
    console.error('[auth:x] Profile lookup rejected.', {
      status: response.status,
    });
    return null;
  }

  const payload = (await response.json()) as Partial<XUserProfile>;
  const profile = payload.data;
  if (
    typeof profile?.id !== 'string' ||
    typeof profile.name !== 'string' ||
    typeof profile.username !== 'string'
  ) {
    console.error('[auth:x] Profile response is missing required fields.', {
      hasData: Boolean(profile),
      hasId: typeof profile?.id === 'string',
      hasName: typeof profile?.name === 'string',
      hasUsername: typeof profile?.username === 'string',
    });
    return null;
  }

  return {
    data: { data: profile },
    user: {
      name: profile.name,
      email: `x-${profile.id}@accounts.invalid`,
      image:
        typeof profile.profile_image_url === 'string'
          ? profile.profile_image_url
          : undefined,
      emailVerified: false,
    },
  };
}

/** 현재 요청의 DB 연결을 사용하는 Better Auth 옵션을 구성합니다. */
export function createAuthOptions(
  env: WorkerEnv,
  database: Pool,
): BetterAuthOptions {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
  }

  const socialProviders = {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.TWITTER_CLIENT_ID && env.TWITTER_CLIENT_SECRET
      ? {
          twitter: {
            clientId: env.TWITTER_CLIENT_ID,
            clientSecret: env.TWITTER_CLIENT_SECRET,
            // 로그인은 프로필 확인만 하지만 X API가 요구하는 tweet.read scope도 요청해야 합니다.
            // 게시물 데이터는 조회하지 않으며 이메일·장기 접근 권한은 요청하지 않습니다.
            disableDefaultScope: true,
            scope: [...SOCIAL_PROVIDER_SCOPES.x],
            // 기본 X 프로필 매핑이 이메일 API를 부르지 않도록 필요한 공개 프로필만 직접 매핑합니다.
            getUserInfo: async (token: { accessToken?: string }) =>
              getXUserInfo(token.accessToken),
          },
        }
      : {}),
    ...(env.KAKAO_CLIENT_ID && env.KAKAO_CLIENT_SECRET
      ? {
          kakao: {
            clientId: env.KAKAO_CLIENT_ID,
            clientSecret: env.KAKAO_CLIENT_SECRET,
            disableDefaultScope: true,
            // 카카오의 변경되지 않는 사용자 ID로 계정을 식별해 이메일 동의를 요구하지 않습니다.
            scope: [...SOCIAL_PROVIDER_SCOPES.kakao],
            mapProfileToUser: (profile: {
              id: number;
              kakao_account?: {
                profile?: { nickname?: string; profile_image_url?: string };
              };
            }) => ({
              email: `kakao-${profile.id}@accounts.invalid`,
              name:
                profile.kakao_account?.profile?.nickname?.trim() || 'H1-KEY 팬',
              image: profile.kakao_account?.profile?.profile_image_url,
              emailVerified: false,
            }),
          },
        }
      : {}),
  };

  return {
    database,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_ORIGIN],
    socialProviders,
    // 계정 탈퇴는 되돌리기 어려우므로 최근 24시간 안에 다시 로그인한 세션만 허용합니다.
    session: { freshAge: 60 * 60 * 24 },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          try {
            await anonymizeAccountCommunityData(
              database,
              env.MEDIA_BUCKET,
              user.id,
            );
          } catch {
            // SQL 오류·파일 경로·provider 정보를 브라우저에 노출하지 않습니다.
            throw new Error(
              '계정 데이터를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
            );
          }
        },
      },
    },
    account: {
      // 로그인 후 사용할 일이 없는 provider token도 저장 시 암호화합니다.
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        // 이름이나 이메일이 같다는 이유로 계정을 자동 병합하지 않고 인증된 명시 동작만 허용합니다.
        disableImplicitLinking: true,
        allowDifferentEmails: true,
        trustedProviders: ['google', 'twitter', 'kakao'],
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const displayName = user.name.trim().slice(0, 40) || 'H1-KEY 팬';
            await database.query(
              `
                insert into profiles (id, display_name)
                values ($1, $2)
                on conflict (id) do nothing
              `,
              [user.id, displayName],
            );
          },
        },
      },
    },
  };
}

/** Worker 요청에 연결된 PostgreSQL로 Better Auth 인스턴스를 만듭니다. */
export function createAuth(env: WorkerEnv, database: Pool) {
  return betterAuth(createAuthOptions(env, database));
}

/** 세션에서 사용자 ID만 확인하고 provider token 등 계정 정보는 반환하지 않습니다. */
export async function resolveSessionUserId(
  env: WorkerEnv,
  database: Pool,
  headers: Headers,
): Promise<string | null> {
  const session = await createAuth(env, database).api.getSession({ headers });
  return session?.user.id ?? null;
}
