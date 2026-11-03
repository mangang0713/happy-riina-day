/**
 * 방명록·후기 작성과 좋아요·사진 변경을 Worker API에 전달합니다.
 * 인증·동의·요청 제한·파일 검증은 브라우저가 아니라 Worker가 최종 판단합니다.
 */

import { requestWorkerApi, requestWorkerApiJson } from './workerApi';

type WorkerContentType = 'guestbook' | 'review';
type WorkerContentResponse = { id: string };

/** Turnstile 검증과 공개 안내 동의 확인을 거쳐 방명록 글을 저장합니다. */
export function createWorkerGuestbookPost(
  body: string,
  turnstileToken: string,
): Promise<WorkerContentResponse> {
  return requestWorkerApiJson('POST', '/guestbook', { body, turnstileToken });
}

/** 작성자·공개 상태를 서버에서 다시 확인하며 방명록 글을 수정합니다. */
export function editWorkerGuestbookPost(
  postId: string,
  body: string,
  turnstileToken: string,
): Promise<WorkerContentResponse> {
  return requestWorkerApiJson(
    'PUT',
    `/guestbook/${encodeURIComponent(postId)}`,
    {
      body,
      turnstileToken,
    },
  );
}

/** 일정당 한 후기 제한과 별점 범위를 Worker에서 검증하고 새 후기를 저장합니다. */
export function createWorkerScheduleReview(
  scheduleId: string,
  body: string,
  rating: number,
  turnstileToken: string,
): Promise<WorkerContentResponse> {
  return requestWorkerApiJson(
    'POST',
    `/schedules/${encodeURIComponent(scheduleId)}/reviews`,
    { body, rating, turnstileToken },
  );
}

/** 기존 후기의 작성자·일정·공개 상태를 확인해 본문과 별점을 수정합니다. */
export function editWorkerScheduleReview(
  scheduleId: string,
  reviewId: string,
  body: string,
  rating: number,
  turnstileToken: string,
): Promise<WorkerContentResponse> {
  return requestWorkerApiJson(
    'PUT',
    `/schedules/${encodeURIComponent(scheduleId)}/reviews/${encodeURIComponent(reviewId)}`,
    { body, rating, turnstileToken },
  );
}

/** 사진은 공개 URL이 아닌 FormData로 보내고 서버 용량·파일 검사를 통과시킵니다. */
export function uploadWorkerCommunityMedia(
  file: File,
  parentType: WorkerContentType,
  parentId: string,
  turnstileToken: string,
): Promise<{ mediaId: string }> {
  const form = new FormData();
  form.set('file', file);
  form.set('parentType', parentType);
  form.set('parentId', parentId);
  form.set('turnstileToken', turnstileToken);

  // 브라우저가 multipart boundary를 설정하므로 Content-Type은 직접 지정하지 않습니다.
  return requestWorkerApi('/media', { method: 'POST', body: form });
}

/** 공개 글에 연결된 사진을 권한 검사 후 Worker와 비공개 R2에서 함께 삭제합니다. */
export function deleteWorkerCommunityMedia(
  mediaId: string,
): Promise<{ deleted: boolean }> {
  return requestWorkerApi(`/media/${encodeURIComponent(mediaId)}`, {
    method: 'DELETE',
  });
}

/** 로그인한 작성자가 본인의 삭제 가능한 공개 글·후기를 지우도록 요청합니다. */
export function deleteWorkerCommunityContent(
  contentType: WorkerContentType,
  contentId: string,
): Promise<{ deleted: boolean }> {
  return requestWorkerApi(
    `/content/${contentType}/${encodeURIComponent(contentId)}`,
    { method: 'DELETE' },
  );
}

/** 일정 좋아요 상태를 로그인 사용자 기준으로 추가하거나 취소합니다. */
export function toggleWorkerScheduleLike(
  scheduleId: string,
): Promise<{ liked: boolean }> {
  return requestWorkerApiJson(
    'POST',
    `/schedules/${encodeURIComponent(scheduleId)}/like`,
    {},
  );
}

/** 현재 공개 안내의 버전과 동의 시각을 서버에서 기록합니다. */
export function acceptWorkerCommunityTerms(): Promise<{
  accepted: boolean;
  version: string;
}> {
  return requestWorkerApi('/me/community-terms', { method: 'POST' });
}
