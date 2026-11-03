/**
 * 신고·이의제기·관리자 조치의 Worker 요청을 묶습니다.
 * 서버는 각 호출에서 작성자, 신고자, 관리자와 게시물 보존 상태를 다시 검사합니다.
 */

import { requestWorkerApiJson } from './workerApi';

type WorkerContentType = 'guestbook' | 'review';

/** 공개 글을 신고하고 선택 설명을 관리자 검토 목록에 전달합니다. */
export function reportWorkerCommunityContent(
  contentType: WorkerContentType,
  contentId: string,
  reason: string,
  details?: string,
): Promise<{ reported: boolean }> {
  return requestWorkerApiJson('POST', '/reports', {
    contentType,
    contentId,
    reason,
    details,
  });
}

/** 숨김 통지에 대한 작성자 이의제기를 보존 기한 안에 제출합니다. */
export function submitWorkerCommunityAppeal(
  contentType: WorkerContentType,
  contentId: string,
  reason: string,
): Promise<{ submitted: boolean; appealId: string }> {
  return requestWorkerApiJson(
    'POST',
    `/content/${contentType}/${encodeURIComponent(contentId)}/appeals`,
    { reason },
  );
}

/** 관리자가 신고를 기각하거나 숨김 사유를 남겨 게시물을 숨깁니다. */
export function decideWorkerCommunityReport(
  reportId: string,
  decision: 'dismiss' | 'hide',
  reason?: string,
): Promise<{ processed: boolean; hidden: boolean }> {
  return requestWorkerApiJson(
    'POST',
    `/admin/reports/${encodeURIComponent(reportId)}/decision`,
    { decision, reason },
  );
}

/** 신고가 없는 경우에도 관리자가 사유를 기록해 공개 게시물을 숨깁니다. */
export function hideWorkerCommunityContent(
  contentType: WorkerContentType,
  contentId: string,
  reason: string,
): Promise<{ hidden: boolean }> {
  return requestWorkerApiJson(
    'POST',
    `/admin/content/${contentType}/${encodeURIComponent(contentId)}/hide`,
    { reason },
  );
}

/** 관리자가 게시물을 복원하고 해당 글의 대기 중인 이의제기도 승인 처리합니다. */
export function restoreWorkerCommunityContent(
  contentType: WorkerContentType,
  contentId: string,
): Promise<{ restored: boolean }> {
  return requestWorkerApiJson(
    'POST',
    `/admin/content/${contentType}/${encodeURIComponent(contentId)}/restore`,
    {},
  );
}

/** 관리자가 이의제기를 결정합니다. 기각할 때 서버가 사유 입력을 필수로 검사합니다. */
export function decideWorkerCommunityAppeal(
  appealId: string,
  decision: 'approve' | 'reject',
  reason?: string,
): Promise<{ decision: 'approve' | 'reject'; expiresAt?: string | null }> {
  return requestWorkerApiJson(
    'POST',
    `/admin/appeals/${encodeURIComponent(appealId)}/decision`,
    { decision, reason },
  );
}
