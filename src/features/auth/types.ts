/** 화면이 특정 인증 SDK 대신 사용하는 로그인 제공자 식별자입니다. */
export type SocialProvider = 'x' | 'google' | 'kakao';

/** 앱 화면에 필요한 최소 사용자 프로필이며 인증 제공자 응답은 노출하지 않습니다. */
export type AuthUser = {
  id: string;
  suggestedName: string;
  email: string | null;
  imageUrl: string | null;
};
