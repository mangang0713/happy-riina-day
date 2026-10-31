/**
 * 이 공급자는 Supabase 로그인 세션과 소셜 로그인 동작을 앱 페이지에 제공합니다.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim() &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
);

/** 앱이 인증 제공자별 로그인 버튼과 OAuth 요청을 구분하는 키입니다. */
export type SocialProvider = 'x' | 'google' | 'kakao';

/** 페이지가 로그인·로그아웃·프로필 상태에 접근할 때 사용하는 인증 기능입니다. */
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (
    provider: SocialProvider,
    returnTo?: string,
  ) => Promise<string | null>;
  signOut: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** 앱 전체에서 Supabase 세션을 한 번 구독해 페이지에 공유합니다. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
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
          setUser(data.session?.user ?? null);
          setLoading(false);
        });
        const { data } = supabase.auth.onAuthStateChange(
          (_event: AuthChangeEvent, session: Session | null) => {
            setUser(session?.user ?? null);
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
            // X 로그인은 계정 확인과 이메일 연결에만 쓰므로 게시물 조회·X 토큰 갱신 권한은 요청하지 않습니다.
            scopes:
              provider === 'x' ? 'users.email users.read' : undefined,
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

  useEffect(() => {
    if (!user) return;
    const returnTo = sessionStorage.getItem('auth-return-to');
    if (returnTo) {
      sessionStorage.removeItem('auth-return-to');
      // OAuth 콜백 뒤에는 현재 BrowserRouter의 경로로 복귀합니다.
      const destination =
        returnTo.startsWith('/') &&
        !returnTo.startsWith('//') &&
        !returnTo.includes('\\')
          ? returnTo
          : '/';
      navigate(destination, { replace: true });
    }
  }, [user, navigate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Context hook를 같은 파일에 두어 단순 구조를 유지합니다.

/** 현재 페이지가 공통 인증 상태와 로그인 기능을 사용하도록 연결합니다. */
// 인증 Provider는 공통 훅도 함께 내보내며, 이 파일은 Vite Fast Refresh 대상 페이지가 아닙니다.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서 사용해야 합니다.');
  }
  return context;
}
