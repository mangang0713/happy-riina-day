/**
 * 인증 제공자를 앱 화면에서 분리하고 빌드 모드에 맞는 로그인 공급자를 선택합니다.
 * GitHub Pages 빌드는 Supabase, Wrangler Worker 빌드는 Better Auth를 사용합니다.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { isWorkerBackend } from '../community/backendMode';
import { getWorkerAuthProviders } from '../community/workerApi';
import { AuthContext, type AuthContextValue } from './authContext';
import {
  signInWithWorkerProvider,
  signOutWorkerUser,
  toWorkerAuthUser,
  workerAuthClient,
} from './workerAuthClient';
import type { AuthUser, SocialProvider } from './types';

const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim() &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
);

/** Supabase 사용자 응답에서 화면에 필요한 공개 프로필 정보만 추립니다. */
function toSupabaseAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null;
  const metadata = user.user_metadata;
  const firstText = (...values: unknown[]) =>
    values
      .find(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      ?.trim();

  return {
    id: user.id,
    suggestedName:
      firstText(
        metadata.user_name,
        metadata.preferred_username,
        metadata.nickname,
        metadata.full_name,
        metadata.name,
      ) ?? '',
    email: user.email ?? null,
    imageUrl:
      firstText(
        metadata.avatar_url,
        metadata.picture,
        metadata.profile_image_url,
      ) ?? null,
  };
}

/** OAuth 복귀 후 보호된 기능을 요청했던 원래 화면으로 돌아갑니다. */
function useRestoreAuthReturnTo(user: AuthUser | null) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;
    const returnTo = sessionStorage.getItem('auth-return-to');
    if (!returnTo) return;
    sessionStorage.removeItem('auth-return-to');
    const destination =
      returnTo.startsWith('/') &&
      !returnTo.startsWith('//') &&
      !returnTo.includes('\\')
        ? returnTo
        : '/';
    navigate(destination, { replace: true });
  }, [user, navigate]);
}

/** 선택된 인증 공급자의 상태와 동작을 공통 화면 context로 제공합니다. */
function AuthValueProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AuthContextValue;
}) {
  useRestoreAuthReturnTo(value.user);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** 기본 웹 배포본은 지금까지 운영한 Supabase Auth를 계속 사용합니다. */
function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void import('../../lib/supabase/client')
      .then(({ supabase }) => {
        if (!active || !supabase) return;
        supabase.auth.getSession().then(({ data, error }) => {
          if (!active) return;
          if (error) console.error('세션 확인 실패:', error.message);
          setUser(toSupabaseAuthUser(data.session?.user));
          setLoading(false);
        });
        const { data } = supabase.auth.onAuthStateChange(
          (_event: AuthChangeEvent, session: Session | null) => {
            setUser(toSupabaseAuthUser(session?.user));
            setLoading(false);
          },
        );
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch((error: unknown) => {
        console.error('Supabase 모듈 로딩 실패:', error);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: supabaseConfigured,
      providers: supabaseConfigured ? ['x', 'google', 'kakao'] : [],
      signIn: async (provider, returnTo = '/') => {
        if (!supabaseConfigured) {
          return '로그인 서버 설정이 완료되지 않았습니다.';
        }
        const { supabase } = await import('../../lib/supabase/client');
        if (!supabase) return '로그인 서버 설정이 완료되지 않았습니다.';
        sessionStorage.setItem('auth-return-to', returnTo);
        const redirectTo = new URL(
          import.meta.env.BASE_URL,
          window.location.origin,
        ).toString();
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            queryParams:
              provider === 'x' ? { response_type: 'code' } : undefined,
            skipBrowserRedirect: false,
          },
        });
        if (error) return error.message;
        return null;
      },
      signOut: async () => {
        if (!supabaseConfigured) {
          return '로그인 서버 설정이 완료되지 않았습니다.';
        }
        const { supabase } = await import('../../lib/supabase/client');
        if (!supabase) return '로그인 서버 설정이 완료되지 않았습니다.';
        const { error } = await supabase.auth.signOut();
        return error?.message ?? null;
      },
    }),
    [loading, user],
  );

  return <AuthValueProvider value={value}>{children}</AuthValueProvider>;
}

/** 로컬 Worker 사이트는 Better Auth의 same-origin 세션 쿠키를 사용합니다. */
function WorkerAuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = workerAuthClient.useSession();
  const [providers, setProviders] = useState<SocialProvider[] | null>(null);
  const user = data?.user ? toWorkerAuthUser(data.user) : null;

  useEffect(() => {
    let active = true;
    getWorkerAuthProviders()
      .then((response) => {
        if (active) setProviders(response.providers);
      })
      .catch(() => {
        if (active) setProviders([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: isPending,
      configured: true,
      providers,
      signIn: async (provider, returnTo = '/') => {
        if (!providers?.includes(provider)) {
          return '이 로그인 제공자는 현재 Worker에 설정되어 있지 않습니다.';
        }
        return signInWithWorkerProvider(provider, returnTo);
      },
      signOut: signOutWorkerUser,
    }),
    [isPending, providers, user],
  );

  return <AuthValueProvider value={value}>{children}</AuthValueProvider>;
}

/** 현재 사이트가 사용하는 로컬/운영 인증 공급자를 빌드 모드로 고릅니다. */
export function AuthProvider({ children }: { children: ReactNode }) {
  return isWorkerBackend ? (
    <WorkerAuthProvider>{children}</WorkerAuthProvider>
  ) : (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  );
}
