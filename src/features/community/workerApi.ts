/**
 * Cloudflare Worker same-origin 요청 공통 처리와 읽기 API 타입 변환을 담당합니다.
 * Supabase 연결과 분리해 두어 기존 페이지 데이터 출처는 이 파일만으로 바뀌지 않습니다.
 */

import type {
  AdminCommunitySettings,
  CommunityAppealResult,
  ContentReport,
  GuestbookPost,
  HiddenCommunityContent,
  MyCommunityContent,
  ScheduleReview,
} from './types';

/** Better Auth 로그인 세션이 가리키는 현재 계정의 최소 응답입니다. */
export type WorkerCurrentUser = {
  user: { id: string };
};

/** 계정 화면에 필요한 본인 표시 이름과 공개 안내 동의 상태입니다. */
export type WorkerProfile = {
  id: string;
  display_name: string;
  community_terms_accepted_at: string | null;
  community_terms_version: string | null;
};

/** 방문자가 작성 기능 상태를 확인할 때 필요한 공개 운영 스위치입니다. */
export type WorkerPublicCommunitySettings = Pick<
  AdminCommunitySettings,
  'community_enabled' | 'uploads_enabled' | 'media_views_enabled'
>;

/** 상단 메뉴에서 관리자 링크를 표시할지 판단하는 최소 권한 정보입니다. */
export type WorkerAdminStatus = { isAdmin: boolean };

/** 현재 Worker에서 자격 증명이 설정된 소셜 로그인 제공자입니다. */
export type WorkerAuthProviders = {
  providers: Array<'x' | 'google' | 'kakao'>;
};

/** 일정 상세에 표시할 좋아요 수와 로그인 사용자의 반응 상태입니다. */
export type WorkerScheduleReactions = {
  likeCount: number;
  liked: boolean;
  ownReviewId?: string;
};

/** Worker의 본인 후기 경로가 미디어 URL을 `url`로 반환하는 응답입니다. */
type WorkerOwnReview = Omit<ScheduleReview, 'is_mine' | 'media'> & {
  media: Array<ScheduleReview['media'][number] & { url?: string }>;
};

type WorkerErrorBody = {
  code?: unknown;
  error?: unknown;
};

/** Worker 요청에서 HTTP 방식과 JSON·파일 본문을 지정하는 옵션입니다. */
export type WorkerApiRequestOptions = Pick<
  RequestInit,
  'method' | 'body' | 'headers'
>;

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

/** Same-origin cookie를 보내고 `{ code, error }`를 공통 오류로 바꿉니다. */
export async function requestWorkerApi<T>(
  path: string,
  options: WorkerApiRequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    response = await fetch(`/api/v1${path}`, {
      ...options,
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers,
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

/** JSON 기반 저장·수정 요청이 same-origin cookie와 공통 오류 처리를 공유합니다. */
export function requestWorkerApiJson<T>(
  method: 'POST' | 'PUT' | 'PATCH',
  path: string,
  payload: unknown,
): Promise<T> {
  return requestWorkerApi<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
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

/** Worker 세션에서 로그인 사용자의 ID만 확인합니다. */
export function getWorkerCurrentUser(): Promise<WorkerCurrentUser> {
  return requestWorkerApi<WorkerCurrentUser>('/me');
}

/** 서버에 설정된 로그인 제공자만 사용자에게 표시합니다. */
export function getWorkerAuthProviders(): Promise<WorkerAuthProviders> {
  return fetch('/api/v1/providers', { credentials: 'same-origin' }).then(
    async (response) => {
      if (!response.ok) {
        throw new Error('로그인 제공자 설정을 확인하지 못했습니다.');
      }
      return (await response.json()) as WorkerAuthProviders;
    },
  );
}

/** 관리자 메뉴 노출을 위해 본인 계정의 관리자 여부만 확인합니다. */
export function getWorkerAdminStatus(): Promise<WorkerAdminStatus> {
  return requestWorkerApi('/me/admin-status');
}

/** 로그인 화면에 필요한 공개 글쓰기·사진 기능 상태를 불러옵니다. */
export function getWorkerPublicCommunitySettings(): Promise<WorkerPublicCommunitySettings> {
  return requestWorkerApi('/settings');
}

/** 계정 화면에서 사용할 로그인 사용자의 프로필과 동의 상태를 읽습니다. */
export function getWorkerMyProfile(): Promise<WorkerProfile> {
  return requestWorkerApi<WorkerProfile>('/me/profile');
}

/** 표시 이름은 본인 프로필에만 수정 요청을 보냅니다. */
export function updateWorkerProfile(
  displayName: string,
): Promise<{ id: string; display_name: string }> {
  return requestWorkerApiJson('PATCH', '/me/profile', { displayName });
}

/** 행사 상세에 필요한 공개 좋아요 수와 내 좋아요·후기 연결 상태를 읽습니다. */
export async function getWorkerScheduleReactions(
  scheduleId: string,
): Promise<WorkerScheduleReactions> {
  const response = await requestWorkerApi<{
    like_count: number;
    liked: boolean;
    own_review_id: string | null;
  }>(`/schedules/${encodeURIComponent(scheduleId)}/reactions`);
  return {
    likeCount: response.like_count,
    liked: response.liked,
    ownReviewId: response.own_review_id ?? undefined,
  };
}

/** 작성 중인 폼에 복원할 공개 상태의 본인 후기를 가져옵니다. */
export async function getWorkerOwnScheduleReview(
  scheduleId: string,
): Promise<ScheduleReview | null> {
  const review = await requestWorkerApi<WorkerOwnReview | null>(
    `/schedules/${encodeURIComponent(scheduleId)}/reviews/own`,
  );
  if (!review) return null;

  // API의 보호된 미디어 경로를 기존 화면이 사용하는 signed_url 필드로 맞춥니다.
  const media = review.media.map(({ url, ...item }) => ({
    ...item,
    signed_url: item.signed_url ?? url,
  }));
  return { ...review, is_mine: true, media };
}

/** 내 게시글 화면에 본인 글과 보존 중인 이의제기 결과를 함께 제공합니다. */
export function getWorkerMyCommunityContent(): Promise<{
  posts: MyCommunityContent[];
  appealResults: CommunityAppealResult[];
}> {
  return requestWorkerApi('/me/content');
}

/** 관리자 검토 화면에서 미처리 신고 목록을 가져옵니다. */
export function getWorkerAdminReports(): Promise<ContentReport[]> {
  return requestWorkerApi('/admin/reports');
}

/** 관리자가 숨겨진 글과 이의제기 상태를 검토할 수 있도록 목록을 가져옵니다. */
export function getWorkerAdminHiddenContent(): Promise<
  HiddenCommunityContent[]
> {
  return requestWorkerApi('/admin/hidden-content');
}

/** 관리자 페이지에서 기능 중단 스위치와 현재 DB·사진 사용량을 읽습니다. */
export function getWorkerAdminCommunitySettings(): Promise<AdminCommunitySettings> {
  return requestWorkerApi('/admin/settings');
}

/** 관리자가 새 글, 업로드, 사진 열람을 각각 중단·재개하도록 요청합니다. */
export function updateWorkerAdminCommunitySettings(
  settings: Partial<WorkerPublicCommunitySettings>,
): Promise<AdminCommunitySettings> {
  return requestWorkerApiJson('PATCH', '/admin/settings', { settings });
}
