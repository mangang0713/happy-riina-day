/**
 * 이 모듈은 커뮤니티 화면의 읽기·쓰기 요청을 Edge Function으로 보내고 응답 오류를 정리합니다.
 */

import type {
  AdminCommunitySettings,
  CommunityAppealResult,
  CommunityMedia,
  CommunitySettings,
  ContentReport,
  GuestbookPost,
  HiddenCommunityContent,
  MyCommunityContent,
  ScheduleReview,
} from './types';
import { supabase, supabaseConfig } from '../../lib/supabase/client';
import { isWorkerBackend } from './backendMode';
import {
  deleteWorkerCommunityContent,
  deleteWorkerCommunityMedia,
  editWorkerGuestbookPost,
  editWorkerScheduleReview,
  toggleWorkerScheduleLike,
  uploadWorkerCommunityMedia,
  createWorkerGuestbookPost,
  createWorkerScheduleReview,
  acceptWorkerCommunityTerms,
} from './workerCommunityWrites';
import {
  getWorkerAdminCommunitySettings,
  getWorkerAdminHiddenContent,
  getWorkerAdminReports,
  WorkerApiError,
  getWorkerCurrentUser,
  getWorkerMyCommunityContent,
  getWorkerMyProfile,
  getWorkerOwnScheduleReview,
  getWorkerPublicCommunitySettings,
  getWorkerScheduleReactions,
  getWorkerScheduleReviews,
  getWorkerGuestbookPosts,
  updateWorkerAdminCommunitySettings,
  updateWorkerProfile,
} from './workerApi';
import {
  hideWorkerCommunityContent,
  reportWorkerCommunityContent,
  restoreWorkerCommunityContent,
  submitWorkerCommunityAppeal,
  decideWorkerCommunityAppeal,
  decideWorkerCommunityReport,
} from './workerModerationWrites';
import { deleteWorkerAuthUser } from '../auth/workerAuthClient';

const PAGE_SIZE = 12;

/** Edge Function 응답의 오류 코드와 화면 표시 메시지를 함께 전달합니다. */
export class CommunityRequestError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'CommunityRequestError';
    this.code = code;
    this.status = status;
  }
}

/** 글 저장 후 사진 업로드가 일부 실패했을 때 이미 저장된 상태를 화면에 알려줍니다. */
export class GuestbookPhotoUploadError extends CommunityRequestError {
  readonly postId: string;
  readonly createdPost: boolean;
  readonly uploadedPhotoCount: number;
  readonly totalPhotoCount: number;

  constructor(
    postId: string,
    createdPost: boolean,
    uploadedPhotoCount: number,
    totalPhotoCount: number,
    error: unknown,
  ) {
    const details = getCommunityErrorDetails(error);
    super(
      details.code,
      details.message,
      error instanceof CommunityRequestError || error instanceof WorkerApiError
        ? error.status
        : undefined,
    );
    this.name = 'GuestbookPhotoUploadError';
    this.postId = postId;
    this.createdPost = createdPost;
    this.uploadedPhotoCount = uploadedPhotoCount;
    this.totalPhotoCount = totalPhotoCount;
  }
}

/** 화면이 서버 오류를 사용자에게 설명할 수 있도록 공통 오류 정보를 뽑습니다. */
export function getCommunityErrorDetails(error: unknown) {
  if (error instanceof CommunityRequestError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof WorkerApiError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: error instanceof Error ? 'REQUEST_FAILED' : 'UNKNOWN_ERROR',
    message:
      error instanceof Error ? error.message : '요청을 완료하지 못했습니다.',
  };
}

/** Supabase Function 응답의 HTTP 상태와 서버 오류 코드를 앱 오류로 바꿉니다. */
async function readFunctionError(error: unknown) {
  if (!(error instanceof Error)) {
    return new CommunityRequestError(
      'FUNCTION_REQUEST_FAILED',
      '요청을 처리하지 못했습니다.',
    );
  }

  const context = (error as Error & { context?: unknown }).context;
  if (context instanceof Response) {
    const body = (await context
      .clone()
      .json()
      .catch(() => null)) as { code?: unknown; error?: unknown } | null;
    const status = context.status;
    const message =
      typeof body?.error === 'string'
        ? body.error
        : status >= 500
          ? '서버에서 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
          : `요청을 처리하지 못했습니다. (HTTP ${status})`;
    const code = typeof body?.code === 'string' ? body.code : `HTTP_${status}`;
    return new CommunityRequestError(code, message, status);
  }

  if (error.name === 'FunctionsFetchError') {
    return new CommunityRequestError(
      'NETWORK_ERROR',
      '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    );
  }
  if (error.name === 'FunctionsRelayError') {
    return new CommunityRequestError(
      'EDGE_FUNCTION_UNAVAILABLE',
      '요청 처리 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  return new CommunityRequestError(
    'FUNCTION_REQUEST_FAILED',
    error.message || '요청을 처리하지 못했습니다.',
  );
}

/** 로그인 기능 설정이 빠진 개발 환경에서 요청 전에 원인을 분명히 알려줍니다. */
function requireClient() {
  if (!supabase) {
    throw new Error(
      'Supabase 연결 설정이 필요합니다. .env.example을 참고해 주세요.',
    );
  }
  return supabase;
}

/** 브라우저의 커뮤니티 작업을 단일 Edge Function의 액션으로 전달합니다. */
async function invoke<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const client = requireClient();
  const { data, error } = await client.functions.invoke('community-api', {
    body: { action, ...payload },
  });
  if (error) throw await readFunctionError(error);
  if (data?.error) {
    throw new CommunityRequestError(
      String(data.code ?? 'REQUEST_REJECTED'),
      String(data.error),
    );
  }
  return data as T;
}

/** 공개 가능한 콘텐츠 사진만 제한 시간 URL로 요청하며, 사진 장애가 글 읽기를 막지 않게 합니다. */
async function addSignedMedia<
  T extends { id: string; media?: CommunityMedia[] },
>(items: T[]): Promise<T[]> {
  if (!items.length) return items;
  const client = requireClient();
  const { data, error } = await client.functions.invoke('community-api', {
    body: {
      action: 'signed-media',
      mediaIds: items.flatMap(
        (item) => item.media?.map((media) => media.id) ?? [],
      ),
    },
  });
  if (error || data?.error) {
    // 사진 URL 기능이 중지되어도 글과 후기는 계속 읽을 수 있게 합니다.
    return items.map((item) => ({
      ...item,
      media: item.media?.map((media) => ({ ...media, signed_url: undefined })),
    }));
  }
  const urls = new Map<string, string>(
    (data?.urls ?? []).map((row: { id: string; signedUrl: string }) => [
      row.id,
      row.signedUrl,
    ]),
  );
  return items.map((item) => ({
    ...item,
    media: item.media?.map((media) => ({
      ...media,
      signed_url: urls.get(media.id),
    })),
  }));
}

/** 방문자 화면이 쓰기 중단 여부를 결정할 수 있도록 공개 커뮤니티 설정을 읽습니다. */
export async function getCommunitySettings(): Promise<CommunitySettings> {
  if (isWorkerBackend) return getWorkerPublicCommunitySettings();
  const client = requireClient();
  const { data, error } = await client
    .rpc('get_public_community_settings')
    .single();
  if (error) throw new Error(error.message);
  return data as CommunitySettings;
}

/** 방명록 공개 글을 페이지 단위로 불러오고 사진을 임시 주소로 연결합니다. */
export async function getGuestbookPosts(page = 0) {
  if (isWorkerBackend) return getWorkerGuestbookPosts(page);
  const client = requireClient();
  const { data, error } = await client.rpc('get_public_guestbook', {
    p_offset: page * PAGE_SIZE,
    p_limit: PAGE_SIZE,
  });
  if (error) throw new Error(error.message);
  return addSignedMedia(
    (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      media: (row.media ?? []) as CommunityMedia[],
    })) as unknown as GuestbookPost[],
  );
}

/** 한 일정의 공개 후기를 페이지 단위로 불러옵니다. */
export async function getScheduleReviews(
  scheduleId: string,
  page = 0,
  limit = PAGE_SIZE,
) {
  if (isWorkerBackend) {
    return getWorkerScheduleReviews(scheduleId, page, limit);
  }
  const client = requireClient();
  const safeLimit = Math.max(1, Math.min(PAGE_SIZE, Math.floor(limit)));
  const { data, error } = await client.rpc('get_public_schedule_reviews', {
    p_schedule_id: scheduleId,
    p_offset: page * safeLimit,
    p_limit: safeLimit,
  });
  if (error) throw new Error(error.message);
  return addSignedMedia(
    (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      media: (row.media ?? []) as CommunityMedia[],
    })) as unknown as ScheduleReview[],
  );
}

/** 로그인 사용자가 작성한 일정 후기를 수정 화면에 불러옵니다. */
export async function getOwnScheduleReview(scheduleId: string) {
  if (isWorkerBackend) return getWorkerOwnScheduleReview(scheduleId);
  const client = requireClient();
  const { data, error } = await client
    .rpc('get_own_schedule_review', { p_schedule_id: scheduleId })
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as unknown as Omit<ScheduleReview, 'is_mine'> & {
    media: CommunityMedia[];
  };
  return (await addSignedMedia([{ ...row, is_mine: true }]))[0];
}

/** 상세 화면에 좋아요 수와 현재 사용자의 좋아요·후기 상태를 제공합니다. */
export async function getScheduleReactions(
  scheduleId: string,
  userId?: string,
) {
  if (isWorkerBackend) return getWorkerScheduleReactions(scheduleId);
  const client = requireClient();
  void userId;
  const { data: rawStats, error } = await client
    .rpc('get_schedule_reaction_stats', { p_schedule_id: scheduleId })
    .single();
  if (error) throw new Error(error.message);
  const data = rawStats as {
    like_count: number | string;
    liked: boolean;
    own_review_id: string | null;
  };
  return {
    likeCount: Number(data.like_count),
    liked: data.liked,
    ownReviewId: data.own_review_id ?? undefined,
  };
}

/** 방명록 글을 생성·수정하고 선택된 사진을 각 파일별로 업로드합니다. */
export async function saveGuestbookPost(
  body: string,
  media: File[],
  postId?: string,
  turnstileToken?: string,
) {
  const createdPost = !postId;
  if (isWorkerBackend) {
    const result = postId
      ? await editWorkerGuestbookPost(postId, body, turnstileToken ?? '')
      : await createWorkerGuestbookPost(body, turnstileToken ?? '');
    let uploadedPhotoCount = 0;
    for (const file of media) {
      try {
        const prepared = await prepareCommunityImage(file);
        await uploadWorkerCommunityMedia(
          prepared,
          'guestbook',
          result.id,
          turnstileToken ?? '',
        );
        uploadedPhotoCount += 1;
      } catch (error) {
        throw new GuestbookPhotoUploadError(
          result.id,
          createdPost,
          uploadedPhotoCount,
          media.length,
          error,
        );
      }
    }
    return result;
  }
  const result = await invoke<{ id: string }>(
    postId ? 'edit-guestbook' : 'create-guestbook',
    { postId, body, turnstileToken },
  );
  let uploadedPhotoCount = 0;
  for (const file of media) {
    try {
      await uploadCommunityImage(file, 'guestbook', result.id, turnstileToken);
      uploadedPhotoCount += 1;
    } catch (error) {
      throw new GuestbookPhotoUploadError(
        result.id,
        createdPost,
        uploadedPhotoCount,
        media.length,
        error,
      );
    }
  }
  return result;
}

/** 개인정보 공개 약관에 동의한 시점을 서버에 기록합니다. */
export async function acceptCommunityTerms() {
  if (isWorkerBackend) return acceptWorkerCommunityTerms();
  return invoke('accept-community-terms');
}

/** 일정 후기를 저장하고 선택 사진을 같은 일정 후기와 연결합니다. */
export async function saveScheduleReview(
  scheduleId: string,
  body: string,
  rating: number,
  media: File[],
  reviewId?: string,
  turnstileToken?: string,
) {
  if (isWorkerBackend) {
    const result = reviewId
      ? await editWorkerScheduleReview(
          scheduleId,
          reviewId,
          body,
          rating,
          turnstileToken ?? '',
        )
      : await createWorkerScheduleReview(
          scheduleId,
          body,
          rating,
          turnstileToken ?? '',
        );
    for (const file of media) {
      const prepared = await prepareCommunityImage(file);
      await uploadWorkerCommunityMedia(
        prepared,
        'review',
        result.id,
        turnstileToken ?? '',
      );
    }
    return result;
  }
  const result = await invoke<{ id: string }>(
    reviewId ? 'edit-review' : 'create-review',
    { reviewId, scheduleId, body, rating, turnstileToken },
  );
  for (const file of media) {
    await uploadCommunityImage(file, 'review', result.id, turnstileToken);
  }
  return result;
}

/** 로그인 세션을 사용해 검증된 이미지 파일을 Edge Function으로 보냅니다. */
async function uploadCommunityImage(
  file: File,
  parentType: 'guestbook' | 'review',
  parentId: string,
  turnstileToken?: string,
) {
  const client = requireClient();
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) {
    throw new CommunityRequestError(
      'AUTH_REQUIRED',
      '사진 업로드는 로그인 후 이용할 수 있습니다.',
    );
  }
  const formData = new FormData();
  formData.set('action', 'upload-image');
  formData.set('parentType', parentType);
  formData.set('parentId', parentId);
  if (turnstileToken) formData.set('turnstileToken', turnstileToken);
  try {
    formData.set('file', await prepareCommunityImage(file));
  } catch (error) {
    throw new CommunityRequestError(
      'IMAGE_PREPARATION_FAILED',
      error instanceof Error
        ? error.message
        : '사진을 업로드용으로 준비하지 못했습니다.',
    );
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseConfig.url}/functions/v1/community-api`, {
      method: 'POST',
      headers: {
        apikey: supabaseConfig.publishableKey!,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });
  } catch {
    throw new CommunityRequestError(
      'UPLOAD_NETWORK_ERROR',
      '사진 전송 중 서버와 연결이 끊겼습니다. 남겨진 글에서 사진이 등록됐는지 확인해 주세요.',
    );
  }

  const rawResponse = await response.text().catch(() => '');
  let data: { code?: unknown; error?: unknown } | null = null;
  try {
    data = rawResponse
      ? (JSON.parse(rawResponse) as { code?: unknown; error?: unknown })
      : null;
  } catch {
    /* 비 JSON 응답은 상태 코드로 안내합니다. */
  }
  if (!response.ok) {
    const message =
      typeof data?.error === 'string'
        ? data.error
        : response.status >= 500
          ? '사진 저장 서버에서 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
          : `사진 업로드에 실패했습니다. (HTTP ${response.status})`;
    const code =
      typeof data?.code === 'string'
        ? data.code
        : `UPLOAD_HTTP_${response.status}`;
    throw new CommunityRequestError(code, message, response.status);
  }
}

/** 서버 전송 전에 큰 사진을 브라우저에서 WebP로 줄여 무료 저장 한도를 아낍니다. */
async function prepareCommunityImage(file: File): Promise<File> {
  if (file.size <= 1024 * 1024) return file;
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('원본 사진이 너무 큽니다. 20MB 이하 사진을 선택해 주세요.');
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('JPG, PNG, WebP 사진만 올릴 수 있습니다.');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('이미지 파일을 읽지 못했습니다.');
  }
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이미지 변환을 시작하지 못했습니다.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let quality = 0.88;
    let blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    while (blob && blob.size > 1024 * 1024 && quality > 0.52) {
      quality -= 0.1;
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
    }
    if (!blob || blob.size > 1024 * 1024) {
      throw new Error(
        '사진을 1MB 이하로 줄이지 못했습니다. 더 작은 사진을 선택해 주세요.',
      );
    }
    if (blob.type !== 'image/webp') {
      throw new Error(
        '이 브라우저에서 사진을 줄이지 못했습니다. 1MB 이하 사진을 선택해 주세요.',
      );
    }
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

/** 로그인 사용자의 일정 좋아요 상태를 서버에서 추가하거나 취소합니다. */
export async function toggleScheduleLike(scheduleId: string) {
  if (isWorkerBackend) return toggleWorkerScheduleLike(scheduleId);
  return invoke<{ liked: boolean }>('toggle-like', { scheduleId });
}

/** 사용자가 본인 콘텐츠를 영구 삭제하도록 서버에 요청합니다. */
export async function deleteCommunityContent(
  contentType: 'guestbook' | 'review',
  contentId: string,
) {
  if (isWorkerBackend) {
    return deleteWorkerCommunityContent(contentType, contentId);
  }
  return invoke('delete-content', { contentType, contentId });
}

/** 관리자가 작성자에게 사유를 남기고 콘텐츠를 숨기도록 요청합니다. */
export async function hideCommunityContent(
  contentType: 'guestbook' | 'review',
  contentId: string,
  reason: string,
) {
  if (isWorkerBackend) {
    return hideWorkerCommunityContent(contentType, contentId, reason);
  }
  return invoke('hide-content', { contentType, contentId, reason });
}

/** 사진 한 장을 Storage와 연결 메타데이터에서 함께 삭제합니다. */
export async function deleteCommunityMedia(mediaId: string) {
  if (isWorkerBackend) return deleteWorkerCommunityMedia(mediaId);
  return invoke('delete-media', { mediaId });
}

/** 신고 대상과 선택적 설명을 기록해 관리자 검토 목록에 전달합니다. */
export async function reportCommunityContent(
  contentType: 'guestbook' | 'review',
  contentId: string,
  reason: string,
  details: string,
) {
  if (isWorkerBackend) {
    return reportWorkerCommunityContent(
      contentType,
      contentId,
      reason,
      details,
    );
  }
  return invoke('report-content', { contentType, contentId, reason, details });
}

/** 관리자가 미처리 신고와 대상 콘텐츠 일부를 확인합니다. */
export async function getAdminReports() {
  if (isWorkerBackend) return getWorkerAdminReports();
  return invoke<ContentReport[]>('get-admin-reports');
}

/** 관리자가 숨겨져 보존 중인 글과 이의제기 진행 상태를 확인합니다. */
export async function getAdminHiddenContent() {
  if (isWorkerBackend) return getWorkerAdminHiddenContent();
  return invoke<HiddenCommunityContent[]>('get-admin-hidden-content');
}

/** 작성자가 자신의 글, 숨김 사유, 진행 중 이의제기와 결과를 확인합니다. */
export async function getMyCommunityContent() {
  if (isWorkerBackend) return getWorkerMyCommunityContent();
  const response = await invoke<
    | MyCommunityContent[]
    | { posts: MyCommunityContent[]; appealResults: CommunityAppealResult[] }
  >('get-my-content');
  return Array.isArray(response)
    ? { posts: response, appealResults: [] }
    : response;
}

/** 작성자가 숨김 통지에 대해 보관 기한 안에 이의제기를 신청합니다. */
export async function submitCommunityAppeal(
  contentType: 'guestbook' | 'review',
  contentId: string,
  reason: string,
) {
  if (isWorkerBackend) {
    return submitWorkerCommunityAppeal(contentType, contentId, reason);
  }
  return invoke('submit-appeal', { contentType, contentId, reason });
}

/** 관리자가 이의제기를 승인하거나 기각하고 작성자에게 결과 사유를 남깁니다. */
export async function resolveCommunityAppeal(
  appealId: string,
  decision: 'approve' | 'reject',
  reason: string,
) {
  if (isWorkerBackend) {
    return decideWorkerCommunityAppeal(appealId, decision, reason);
  }
  return invoke('resolve-appeal', { appealId, decision, reason });
}

/** 관리자가 검토 후 숨김 상태의 콘텐츠를 공개로 복원합니다. */
export async function restoreHiddenCommunityContent(
  contentType: 'guestbook' | 'review',
  contentId: string,
) {
  if (isWorkerBackend) {
    return restoreWorkerCommunityContent(contentType, contentId);
  }
  return invoke('restore-hidden-content', { contentType, contentId });
}

/** 관리자가 신고를 기각하거나 사유와 함께 대상 글을 숨깁니다. */
export async function moderateReport(
  reportId: string,
  decision: 'dismiss' | 'hide',
  reason = '',
) {
  if (isWorkerBackend) {
    return decideWorkerCommunityReport(reportId, decision, reason);
  }
  return invoke('moderate-report', { reportId, decision, reason });
}

/** 관리자가 운영 스위치와 저장소 사용량을 확인합니다. */
export async function getAdminCommunitySettings(): Promise<AdminCommunitySettings> {
  if (isWorkerBackend) return getWorkerAdminCommunitySettings();
  return invoke<AdminCommunitySettings>('get-admin-settings');
}

/** 관리자가 새 글·사진 업로드·사진 열람 기능을 원격으로 중지하거나 재개합니다. */
export async function updateAdminCommunitySettings(
  settings: Partial<
    Pick<
      CommunitySettings,
      'community_enabled' | 'uploads_enabled' | 'media_views_enabled'
    >
  >,
) {
  if (isWorkerBackend) return updateWorkerAdminCommunitySettings(settings);
  return invoke('update-admin-settings', { settings });
}

/** 로그인 사용자의 공개 표시 이름을 데이터베이스 검증 함수에 저장합니다. */
export async function updateProfile(displayName: string) {
  if (isWorkerBackend) return updateWorkerProfile(displayName);
  const client = requireClient();
  const { data, error } = await client.rpc('save_my_display_name', {
    p_display_name: displayName,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** 로그인 계정과 인증 연결을 포함한 탈퇴 처리를 서버에 요청합니다. */
export async function deleteAccount() {
  if (isWorkerBackend) {
    const error = await deleteWorkerAuthUser();
    if (error) {
      throw new CommunityRequestError('ACCOUNT_DELETE_FAILED', error);
    }
    return { deleted: true };
  }
  return invoke('delete-account');
}

/** 방명록과 후기에서 공통으로 사용할 공개 프로필 이름을 조회합니다. */
export async function getProfile(userId: string) {
  if (isWorkerBackend) {
    const { user } = await getWorkerCurrentUser();
    if (user.id !== userId) return null;
    const profile = await getWorkerMyProfile();
    return { id: profile.id, display_name: profile.display_name };
  }
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; display_name: string } | null;
}

/** 화면이 Supabase 사용자 기능을 제공할 수 있는 설정 상태인지 확인합니다. */
export function communityConfigured() {
  return isWorkerBackend || Boolean(supabase);
}
