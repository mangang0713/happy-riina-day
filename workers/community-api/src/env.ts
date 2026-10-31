/** Worker 전용 연결값입니다. DB, 인증 비밀값, 정적 파일, 비공개 사진은 서버에서만 접근합니다. */
import type { Pool } from 'pg';

export interface WorkerEnv {
  ASSETS: Fetcher;
  HYPERDRIVE: Hyperdrive;
  MEDIA_BUCKET: R2Bucket;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  APP_ORIGIN: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TWITTER_CLIENT_ID?: string;
  TWITTER_CLIENT_SECRET?: string;
  KAKAO_CLIENT_ID?: string;
  KAKAO_CLIENT_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
}

/** 요청 처리 중 만들어 공유하는 객체입니다. 요청 종료 때 DB 연결을 닫습니다. */
export interface WorkerVariables {
  database: Pool;
}
