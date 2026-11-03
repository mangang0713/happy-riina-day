/**
 * Worker 정적 사이트 빌드에서는 브라우저 Supabase SDK를 포함하지 않습니다.
 * Supabase 연결을 선택하는 GitHub Pages 빌드는 기존 client 모듈을 사용합니다.
 */
export const supabase = null;

export const supabaseConfig = {
  url: undefined,
  publishableKey: undefined,
  isConfigured: false,
};
