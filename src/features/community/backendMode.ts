/**
 * GitHub Pages 기본 빌드는 기존 Supabase를 사용하고,
 * Wrangler가 만드는 로컬 Worker 사이트만 새 백엔드에 연결합니다.
 */
export const isWorkerBackend = import.meta.env.MODE === 'worker';
