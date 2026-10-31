import { Pool } from 'pg';
import type { WorkerEnv } from './env';

/** 요청 하나에 사용할 PostgreSQL 클라이언트를 만듭니다. 연결 재사용은 Hyperdrive가 맡습니다. */
export function createDatabase(env: WorkerEnv): Pool {
  if (!env.HYPERDRIVE?.connectionString) {
    throw new Error('PostgreSQL connection is not configured.');
  }

  const pool = new Pool({
    connectionString: env.HYPERDRIVE.connectionString,
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  // 연결 URL과 자격 증명이 런타임 오류 로그에 섞이지 않도록 pool 오류를 출력하지 않습니다.
  pool.on('error', () => undefined);
  return pool;
}
