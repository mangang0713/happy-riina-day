/**
 * 이 모듈은 신고·숨김 콘텐츠의 관리자 처리와 보관 만료 시점의 영구 삭제를 수행합니다.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { HttpError } from './http.ts';

/** 게시물에 연결된 사진 파일과 메타데이터를 제거하고 계정 사용량을 반환합니다. */
export async function removeMediaForContent(
  client: SupabaseClient,
  contentType: string,
  contentId: string,
) {
  const key =
    contentType === 'guestbook' ? 'guestbook_post_id' : 'schedule_review_id';
  const { data: media, error } = await client
    .from('community_media')
    .select('id, owner_id, object_path, byte_size')
    .eq(key, contentId);
  if (error) {
    throw new HttpError(
      500,
      'MODERATION_OPERATION_FAILED',
      '첨부 사진 정보를 읽을 수 없습니다.',
    );
  }
  if (!media?.length) return;
  const paths = media.map((item) => item.object_path);
  const { error: storageError } = await client.storage
    .from('community-images')
    .remove(paths);
  if (storageError) {
    throw new HttpError(
      503,
      'STORAGE_UNAVAILABLE',
      '첨부 사진 파일을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  const { error: removeRecordsError } = await client.rpc(
    'remove_community_media_records',
    {
      p_media_ids: media.map((item) => item.id),
    },
  );
  if (removeRecordsError) {
    throw new HttpError(
      500,
      'OPERATION_FAILED',
      '사진 사용량과 첨부 기록을 함께 갱신하지 못했습니다.',
    );
  }
}

/** 정책상 본문은 보존하고 사진 객체만 제거해야 할 때 Storage 파일을 정리합니다. */
export async function removeStorageObjectsForContent(
  client: SupabaseClient,
  contentType: string,
  contentId: string,
) {
  const key =
    contentType === 'guestbook' ? 'guestbook_post_id' : 'schedule_review_id';
  const { data: media, error } = await client
    .from('community_media')
    .select('object_path')
    .eq(key, contentId);
  if (error) {
    throw new HttpError(
      500,
      'MODERATION_OPERATION_FAILED',
      '첨부 사진 정보를 읽을 수 없습니다.',
    );
  }
  if (!media?.length) return;
  const { error: storageError } = await client.storage
    .from('community-images')
    .remove(media.map((item) => item.object_path));
  if (storageError) {
    throw new HttpError(
      503,
      'STORAGE_UNAVAILABLE',
      '첨부 사진 파일을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
}

/** 즉시 영구 삭제가 허용된 콘텐츠와 사진·관계 기록을 함께 제거합니다. */
export async function permanentlyDeleteCommunityContent(
  client: SupabaseClient,
  contentType: string,
  contentId: string,
) {
  await removeMediaForContent(client, contentType, contentId);
  const { data, error } = await client.rpc('purge_community_content_record', {
    p_content_type: contentType,
    p_content_id: contentId,
    p_required_status: null,
  });
  if (error || !data) {
    throw new HttpError(
      500,
      'MODERATION_OPERATION_FAILED',
      '게시물과 관련 기록을 완전히 삭제하지 못했습니다.',
    );
  }
}

/** 관리자·작성자 목록에 최신 이의제기와 제한 URL 사진을 붙여 반환합니다. */
export async function attachModerationDetails(
  client: SupabaseClient,
  items: Array<Record<string, unknown>>,
) {
  if (!items.length) return items;
  const ids = items.map((item) => String(item.id));
  const { data: appeals, error: appealError } = await client
    .from('content_appeals')
    .select(
      'id, content_type, content_id, reason, status, submitted_at, decided_at, decision_reason',
    )
    .in('content_id', ids)
    .order('submitted_at', { ascending: false });
  if (appealError) {
    throw new HttpError(
      500,
      'OPERATION_FAILED',
      '이의제기 정보를 불러오지 못했습니다.',
    );
  }
  const latestAppealByContent = new Map<string, (typeof appeals)[number]>();
  for (const appeal of appeals ?? []) {
    const key = `${appeal.content_type}:${appeal.content_id}`;
    if (!latestAppealByContent.has(key)) latestAppealByContent.set(key, appeal);
  }

  const mediaRows: Array<{
    id: string;
    object_path: string;
    byte_size: number;
    mediaContentType: string;
    parentType: 'guestbook' | 'review';
    parentId: string;
  }> = [];
  const guestbookIds = items
    .filter((item) => item.content_type === 'guestbook')
    .map((item) => String(item.id));
  const reviewIds = items
    .filter((item) => item.content_type === 'review')
    .map((item) => String(item.id));
  if (guestbookIds.length) {
    const { data, error } = await client
      .from('community_media')
      .select('id, object_path, byte_size, content_type, guestbook_post_id')
      .in('guestbook_post_id', guestbookIds);
    if (error) {
      throw new HttpError(
        500,
        'OPERATION_FAILED',
        '게시물 사진 정보를 불러오지 못했습니다.',
      );
    }
    mediaRows.push(
      ...(data ?? []).map((item) => ({
        id: item.id,
        object_path: item.object_path,
        byte_size: item.byte_size,
        mediaContentType: item.content_type,
        parentType: 'guestbook' as const,
        parentId: item.guestbook_post_id,
      })),
    );
  }
  if (reviewIds.length) {
    const { data, error } = await client
      .from('community_media')
      .select('id, object_path, byte_size, content_type, schedule_review_id')
      .in('schedule_review_id', reviewIds);
    if (error) {
      throw new HttpError(
        500,
        'OPERATION_FAILED',
        '게시물 사진 정보를 불러오지 못했습니다.',
      );
    }
    mediaRows.push(
      ...(data ?? []).map((item) => ({
        id: item.id,
        object_path: item.object_path,
        byte_size: item.byte_size,
        mediaContentType: item.content_type,
        parentType: 'review' as const,
        parentId: item.schedule_review_id,
      })),
    );
  }

  const result: Array<
    Record<string, unknown> & {
      appeal: (typeof appeals)[number] | null;
      media: Array<Record<string, unknown>>;
    }
  > = items.map((item) => ({
    ...item,
    appeal:
      latestAppealByContent.get(`${item.content_type}:${item.id}`) ?? null,
    media: [] as Array<Record<string, unknown>>,
  }));
  await Promise.all(
    mediaRows.map(async (media) => {
      const parent = result.find(
        (item) =>
          item.id === media.parentId && item.content_type === media.parentType,
      );
      if (!parent) return;
      const { data } = await client.storage
        .from('community-images')
        .createSignedUrl(String(media.object_path), 300);
      if (data?.signedUrl) {
        parent.media.push({
          id: media.id,
          byte_size: media.byte_size,
          content_type: media.mediaContentType,
          signed_url: data.signedUrl,
        });
      }
    }),
  );
  return result;
}

/** 예약 삭제 요청의 비밀 헤더를 비교해 문자열 위치별 시간 차이를 줄입니다. */
export function safeSecretEquals(received: string, expected: string) {
  if (!received || !expected || received.length !== expected.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/** 7일 보관이 끝난 숨김 글을 이의제기 상태와 대조하고 만료분만 영구 삭제합니다. */
export async function purgeExpiredCommunityContent(client: SupabaseClient) {
  const now = new Date().toISOString();
  const { error: appealResultError } = await client
    .from('content_appeal_results')
    .delete()
    .lte('expires_at', now);
  if (appealResultError) {
    throw new HttpError(
      500,
      'OPERATION_FAILED',
      '만료된 이의제기 결과 안내를 정리하지 못했습니다.',
    );
  }

  const [guestbookResult, reviewResult] = await Promise.all([
    client
      .from('guestbook_posts')
      .select('id, purge_after')
      .eq('status', 'hidden')
      .lte('purge_after', now)
      .order('purge_after')
      .limit(50),
    client
      .from('schedule_reviews')
      .select('id, purge_after')
      .eq('status', 'hidden')
      .lte('purge_after', now)
      .order('purge_after')
      .limit(50),
  ]);
  if (guestbookResult.error || reviewResult.error) {
    throw new HttpError(
      500,
      'OPERATION_FAILED',
      '만료된 숨김 게시물을 확인하지 못했습니다.',
    );
  }
  const candidates = [
    ...(guestbookResult.data ?? []).map((item) => ({
      ...item,
      content_type: 'guestbook' as const,
    })),
    ...(reviewResult.data ?? []).map((item) => ({
      ...item,
      content_type: 'review' as const,
    })),
  ];
  if (!candidates.length) return { purged: 0, waitingForAppeal: 0 };

  const { data: pendingAppeals, error: pendingError } = await client
    .from('content_appeals')
    .select('content_type, content_id')
    .eq('status', 'pending')
    .in(
      'content_id',
      candidates.map((item) => item.id),
    );
  if (pendingError) {
    throw new HttpError(
      500,
      'OPERATION_FAILED',
      '진행 중인 이의제기를 확인하지 못했습니다.',
    );
  }
  const pendingKeys = new Set(
    (pendingAppeals ?? []).map(
      (appeal) => `${appeal.content_type}:${appeal.content_id}`,
    ),
  );
  let purged = 0;
  let failed = 0;
  for (const item of candidates) {
    if (pendingKeys.has(`${item.content_type}:${item.id}`)) continue;
    try {
      const { data: claimed, error: claimError } = await client.rpc(
        'claim_expired_community_content_for_purge',
        {
          p_content_type: item.content_type,
          p_content_id: item.id,
        },
      );
      if (claimError) {
        throw new HttpError(
          500,
          'MODERATION_OPERATION_FAILED',
          '영구 삭제 작업을 시작하지 못했습니다.',
        );
      }
      if (!claimed) continue;
      await removeMediaForContent(client, item.content_type, item.id);
      const { data: removed, error: purgeError } = await client.rpc(
        'purge_community_content_record',
        {
          p_content_type: item.content_type,
          p_content_id: item.id,
          p_required_status: 'purging',
        },
      );
      if (purgeError || !removed) {
        throw new HttpError(
          500,
          'MODERATION_OPERATION_FAILED',
          '만료된 게시물을 최종 삭제하지 못했습니다.',
        );
      }
      purged += 1;
    } catch (error) {
      failed += 1;
      console.error(
        'Expired community content purge failed',
        item.content_type,
        item.id,
        error,
      );
      await client.rpc('release_community_content_purge_claim', {
        p_content_type: item.content_type,
        p_content_id: item.id,
      });
    }
  }
  return { purged, waitingForAppeal: pendingKeys.size, failed };
}
