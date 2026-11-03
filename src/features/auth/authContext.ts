/** 화면 컴포넌트가 인증 제공자와 관계없이 사용할 공통 상태·동작입니다. */
import { createContext, useContext } from 'react';
import type { AuthUser, SocialProvider } from './types';

/** 로그인 상태와 화면에 필요한 인증 동작을 앱에 제공합니다. */
export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  providers: SocialProvider[] | null;
  signIn: (
    provider: SocialProvider,
    returnTo?: string,
  ) => Promise<string | null>;
  signOut: () => Promise<string | null>;
};

/** 선택한 로그인 공급자의 상태를 앱 페이지 사이에 공유합니다. */
export const AuthContext = createContext<AuthContextValue | null>(null);

/** 현재 페이지가 공통 인증 상태와 로그인 기능을 사용하도록 연결합니다. */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서 사용해야 합니다.');
  }
  return context;
}
