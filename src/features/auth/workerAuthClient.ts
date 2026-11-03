/**
 * Better Auth 브라우저 요청을 같은 출처의 Hono Worker로 전달합니다.
 * Wrangler Worker 빌드에서 AuthProvider가 이 클라이언트를 사용합니다.
 */

import { createAuthClient } from 'better-auth/react';
import type { AuthUser, SocialProvider } from './types';

/** 같은 출처의 `/api/auth/*`와 세션 쿠키를 사용하는 Better Auth 클라이언트입니다. */
export const workerAuthClient = createAuthClient();

/** 인증 화면의 X 이름을 Better Auth의 Twitter provider 키로 변환합니다. */
function toBetterAuthProvider(provider: SocialProvider) {
  return provider === 'x' ? 'twitter' : provider;
}

/** 외부 주소로 OAuth 복귀를 유도하지 않도록 같은 출처 URL만 허용합니다. */
function toSafeCallbackUrl(returnTo: string) {
  const callback = new URL(returnTo, window.location.origin);
  if (callback.origin !== window.location.origin) {
    return new URL('/', window.location.origin).toString();
  }
  return callback.toString();
}

/** Better Auth 응답에서 앱 화면이 사용하는 최소 프로필을 만듭니다. */
export function toWorkerAuthUser(user: {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}): AuthUser {
  return {
    id: user.id,
    suggestedName: user.name?.trim() ?? '',
    email: user.email ?? null,
    imageUrl: user.image ?? null,
  };
}

/** 현재 Worker 세션을 읽고, 미로그인은 null로 반환합니다. */
export async function getWorkerAuthUser(): Promise<AuthUser | null> {
  const { data, error } = await workerAuthClient.getSession();
  if (error) throw new Error(error.message);
  return data?.user ? toWorkerAuthUser(data.user) : null;
}

/** Worker가 설정한 소셜 제공자로 로그인하고 안전한 복귀 경로를 지정합니다. */
export async function signInWithWorkerProvider(
  provider: SocialProvider,
  returnTo: string,
): Promise<string | null> {
  const { error } = await workerAuthClient.signIn.social({
    provider: toBetterAuthProvider(provider),
    callbackURL: toSafeCallbackUrl(returnTo),
  });
  return error?.message ?? null;
}

/** Worker 세션을 종료합니다. Better Auth가 같은 출처 쿠키를 만료시킵니다. */
export async function signOutWorkerUser(): Promise<string | null> {
  const { error } = await workerAuthClient.signOut();
  return error?.message ?? null;
}

/** 최근 인증된 세션에서 Better Auth가 계정과 연결 자료를 제거합니다. */
export async function deleteWorkerAuthUser(): Promise<string | null> {
  const { error } = await workerAuthClient.deleteUser({});
  return error?.message ?? null;
}
