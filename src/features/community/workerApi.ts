/**
 * Cloudflare Worker API로 보내는 same-origin 요청과 공개 목록 조회를 담당합니다.
 * Supabase 연결과 분리해 두어 현재 페이지 데이터 출처는 이 파일만으로 바뀌지 않습니다.
 */

import type { GuestbookPost, ScheduleReview } from './types';

type WorkerErrorBody = {
  code?: unknown;
  error?: unknown;
};

/** Worker의 표준 오류 코드와 HTTP 상태를 화면 계층으로 전달합니다. */
export class WorkerApiError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'WorkerApiError';
    this.code = code;
    this.status = status;
  }
}

/** Same-origin cookie를 자동으로 보내고 `{ code, error }` 오류 계약을 해석합니다. */
async function requestWorkerApi<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new WorkerApiError(
      'NETWORK_ERROR',
      'Worker API에 연결하지 못했습니다. 네트워크를 확인해 주세요.',
    );
  }

  const rawBody = await response.text().catch(() => '');
  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = payload as WorkerErrorBody | null;
    throw new WorkerApiError(
      typeof error?.code === 'string' ? error.code : `HTTP_${response.status}`,
      typeof error?.error === 'string'
        ? error.error
        : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      response.status,
    );
  }
  if (payload === null) {
    throw new WorkerApiError(
      'INVALID_RESPONSE',
      '서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.',
      response.status,
    );
  }
  return payload as T;
}

/** Worker의 공개 방명록 배열을 기존 커뮤니티 화면 타입으로 가져옵니다. */
export function getWorkerGuestbookPosts(page = 0): Promise<GuestbookPost[]> {
  const safePage = Number.isSafeInteger(page) ? Math.max(0, page) : 0;
  return requestWorkerApi<GuestbookPost[]>(`/guestbook?page=${safePage}`);
}

/** 일정별 공개 후기를 지정한 페이지 크기로 가져옵니다. */
export function getWorkerScheduleReviews(
  scheduleId: string,
  page = 0,
  limit = 12,
): Promise<ScheduleReview[]> {
  const safePage = Number.isSafeInteger(page) ? Math.max(0, page) : 0;
  const safeLimit = Number.isSafeInteger(limit)
    ? Math.max(1, Math.min(12, limit))
    : 12;
  const query = new URLSearchParams({
    page: String(safePage),
    limit: String(safeLimit),
  });
  return requestWorkerApi<ScheduleReview[]>(
    `/schedules/${encodeURIComponent(scheduleId)}/reviews?${query}`,
  );
}
