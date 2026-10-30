/**
 * 이 모듈은 커뮤니티 사진 업로드·삭제와 제한된 보기 URL 발급을 처리합니다.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { permanentlyDeleteCommunityContent } from './moderation.ts';
import { HttpError } from './http.ts';

/** 공개 상태의 콘텐츠 사진에만 짧게 만료되는 비공개 Storage URL을 발급합니다. */
export async function signedMedia(
  client: SupabaseClient,
  ids: unknown,
  readSettings: (
    client: SupabaseClient,
  ) => Promise<{ media_views_enabled: boolean }>,
) {
  const current = await readSettings(client);
  if (!current.media_views_enabled) {
    throw new HttpError(
      503,
      'FEATURE_UNAVAILABLE',
      '사진 열람을 잠시 중단했습니다.',
    );
  }
  if (
    !Array.isArray(ids) ||
    ids.length > 36 ||
    ids.some((id) => typeof id !== 'string')
  ) {
    throw new HttpError(
      400,
      'INVALID_INPUT',
      '사진 요청 형식이 올바르지 않습니다.',
    );
  }
  const uniqueIds = [...new Set(ids as string[])];
  if (uniqueIds.length === 0) return { urls: [] };
  const { data: media, error } = await client
    .from('community_media')
    .select('id, object_path, guestbook_post_id, schedule_review_id')
    .in('id', uniqueIds);
  if (error) {
    throw new HttpError(
      500,
      'OPERATION_FAILED',
      '사진 정보를 불러오지 못했습니다.',
    );
  }
  const urls = [];
  for (const item of media ?? []) {
    let published = false;
    if (item.guestbook_post_id) {
      const { data } = await client
        .from('guestbook_posts')
        .select('status')
        .eq('id', item.guestbook_post_id)
        .maybeSingle();
      published = data?.status === 'published';
    } else if (item.schedule_review_id) {
      const { data } = await client
        .from('schedule_reviews')
        .select('status')
        .eq('id', item.schedule_review_id)
        .maybeSingle();
      published = data?.status === 'published';
    }
    if (!published) continue;
    const { data, error: signError } = await client.storage
      .from('community-images')
      .createSignedUrl(item.object_path, 300);
    if (!signError && data?.signedUrl) {
      urls.push({ id: item.id, signedUrl: data.signedUrl });
    }
  }
  return { urls };
}

/** IP 원문 대신 해시를 저장해 공개 사진 URL 요청 횟수를 제한합니다. */
export async function allowMediaRequest(
  request: Request,
  client: SupabaseClient,
) {
  const forwardedFor = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  const ip =
    request.headers.get('cf-connecting-ip') ?? forwardedFor ?? 'unknown-client';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip),
  );
  const ipHash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const { data, error } = await client.rpc('consume_public_media_rate_limit', {
    p_ip_hash: ipHash,
    p_limit: 50,
    p_window_seconds: 60,
  });
  if (error) {
    throw new HttpError(
      503,
      'MEDIA_RATE_LIMIT_UNAVAILABLE',
      '사진 요청 제한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  return Boolean(data);
}

/** 작성자 본인이 공개 상태 글을 삭제할 때 사진·본문을 함께 제거합니다. */
export async function deleteCommunityContent(
  client: SupabaseClient,
  contentType: string,
  contentId: string,
  userId: string,
) {
  const table =
    contentType === 'guestbook' ? 'guestbook_posts' : 'schedule_reviews';
  const { data: post, error: ownershipError } = await client
    .from(table)
    .select('id, user_id, status')
    .eq('id', contentId)
    .maybeSingle();
  if (ownershipError) {
    throw new HttpError(
      500,
      'CONTENT_LOOKUP_FAILED',
      '게시물을 확인하지 못했습니다.',
    );
  }
  if (!post) {
    throw new HttpError(404, 'CONTENT_NOT_FOUND', '게시물을 찾지 못했습니다.');
  }
  if (post.user_id !== userId) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      '본인 게시물만 영구 삭제할 수 있습니다. 관리자 조치는 숨김 처리와 이의제기를 이용해 주세요.',
    );
  }
  if (post.status !== 'published') {
    throw new HttpError(
      409,
      'CONTENT_UNDER_REVIEW',
      '숨김 검토 중인 게시물은 이의제기 기간이 끝날 때까지 직접 삭제할 수 없습니다.',
    );
  }
  await permanentlyDeleteCommunityContent(client, contentType, contentId);
}

/** 작성자 또는 운영자 권한을 확인한 뒤 사진과 저장 용량 기록을 함께 삭제합니다. */
export async function deleteCommunityMedia(
  client: SupabaseClient,
  mediaId: string,
  userId: string,
  checkAdmin: (client: SupabaseClient, userId: string) => Promise<boolean>,
) {
  const { data: media, error: mediaError } = await client
    .from('community_media')
    .select(
      'id, owner_id, object_path, byte_size, guestbook_post_id, schedule_review_id',
    )
    .eq('id', mediaId)
    .maybeSingle();
  if (mediaError) {
    throw new HttpError(
      500,
      'MEDIA_LOOKUP_FAILED',
      '첨부 사진 정보를 확인하지 못했습니다.',
    );
  }
  if (!media) {
    throw new HttpError(404, 'MEDIA_NOT_FOUND', '첨부 사진을 찾지 못했습니다.');
  }
  if (media.owner_id !== userId && !(await checkAdmin(client, userId))) {
    throw new HttpError(403, 'FORBIDDEN', '본인 사진만 삭제할 수 있습니다.');
  }
  if (media.guestbook_post_id) {
    const { data } = await client
      .from('guestbook_posts')
      .select('status')
      .eq('id', media.guestbook_post_id)
      .maybeSingle();
    if (data?.status === 'hidden') {
      throw new HttpError(
        409,
        'STATE_CONFLICT',
        '숨김 검토 기간에는 게시물과 사진을 보존합니다.',
      );
    }
  }
  if (media.schedule_review_id) {
    const { data } = await client
      .from('schedule_reviews')
      .select('status')
      .eq('id', media.schedule_review_id)
      .maybeSingle();
    if (data?.status === 'hidden') {
      throw new HttpError(
        409,
        'STATE_CONFLICT',
        '숨김 검토 기간에는 게시물과 사진을 보존합니다.',
      );
    }
  }
  const { error: storageError } = await client.storage
    .from('community-images')
    .remove([media.object_path]);
  if (storageError) {
    throw new HttpError(
      503,
      'STORAGE_UNAVAILABLE',
      '첨부 사진 파일을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (media.owner_id) {
    const { error: quotaError } = await client.rpc('release_community_media', {
      p_user_id: media.owner_id,
      p_byte_size: media.byte_size,
    });
    if (quotaError) {
      throw new HttpError(
        500,
        'OPERATION_FAILED',
        '사진 사용량을 갱신하지 못했습니다.',
      );
    }
  }
  const { error: deleteError } = await client
    .from('community_media')
    .delete()
    .eq('id', media.id);
  if (deleteError) {
    throw new HttpError(
      500,
      'OPERATION_FAILED',
      '첨부 사진 기록을 지우지 못했습니다.',
    );
  }
}

/** 이미지 형식·용량·동의·소유권·개수·계정별 용량을 확인하고 비공개 저장합니다. */
export async function uploadImage(
  userId: string,
  client: SupabaseClient,
  form: FormData,
  dependencies: {
    assertCommunityEnabled: (
      client: SupabaseClient,
    ) => Promise<{ uploads_enabled: boolean }>;
    requireCommunityTerms: (
      client: SupabaseClient,
      userId: string,
    ) => Promise<void>;
    takeLimit: (
      client: SupabaseClient,
      userId: string,
      action: string,
      limit: number,
      seconds?: number,
    ) => Promise<void>;
  },
) {
  const current = await dependencies.assertCommunityEnabled(client);
  await dependencies.requireCommunityTerms(client, userId);
  if (!current.uploads_enabled) {
    throw new HttpError(
      503,
      'FEATURE_UNAVAILABLE',
      '사진 업로드를 잠시 중단했습니다.',
    );
  }
  await dependencies.takeLimit(client, userId, 'upload-image', 6, 3600);
  const parentType = form.get('parentType');
  const parentId = form.get('parentId');
  const file = form.get('file');
  if (
    (parentType !== 'guestbook' && parentType !== 'review') ||
    typeof parentId !== 'string' ||
    !(file instanceof File)
  ) {
    throw new HttpError(
      400,
      'INVALID_INPUT',
      '사진 업로드 정보가 올바르지 않습니다.',
    );
  }
  if (file.size < 1) {
    throw new HttpError(
      400,
      'EMPTY_IMAGE',
      '비어 있는 사진 파일은 올릴 수 없습니다.',
    );
  }
  if (file.size > 1048576) {
    throw new HttpError(
      413,
      'IMAGE_TOO_LARGE',
      '사진은 장당 1MB 이하로 올려 주세요.',
    );
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new HttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'JPG, PNG, WebP 사진만 올릴 수 있습니다.',
    );
  }
  const buffer = new Uint8Array(await file.arrayBuffer());
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const webp =
    new TextDecoder().decode(buffer.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(buffer.slice(8, 12)) === 'WEBP';
  if (
    !(file.type === 'image/jpeg' && jpeg) &&
    !(file.type === 'image/png' && png) &&
    !(file.type === 'image/webp' && webp)
  ) {
    throw new HttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      '파일 내용과 이미지 형식이 일치하지 않습니다.',
    );
  }
  const parentTable =
    parentType === 'guestbook' ? 'guestbook_posts' : 'schedule_reviews';
  const parentKey =
    parentType === 'guestbook' ? 'guestbook_post_id' : 'schedule_review_id';
  const { data: parent, error: parentError } = await client
    .from(parentTable)
    .select('id')
    .eq('id', parentId)
    .eq('user_id', userId)
    .eq('status', 'published')
    .maybeSingle();
  if (parentError) {
    throw new HttpError(
      503,
      'POST_LOOKUP_UNAVAILABLE',
      '사진을 연결할 게시물을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (!parent) {
    throw new HttpError(
      404,
      'POST_NOT_FOUND',
      '사진을 연결할 본인 게시물을 찾지 못했습니다.',
    );
  }
  const { count, error: countError } = await client
    .from('community_media')
    .select('id', { count: 'exact', head: true })
    .eq(parentKey, parentId);
  if (countError) {
    throw new HttpError(
      503,
      'MEDIA_QUOTA_UNAVAILABLE',
      '사진 개수를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if ((count ?? 0) >= 3) {
    throw new HttpError(
      409,
      'STATE_CONFLICT',
      '게시물당 사진은 최대 3장까지 첨부할 수 있습니다.',
    );
  }
  const { data: reservationId, error: reserveError } = await client.rpc(
    'reserve_community_media',
    { p_user_id: userId, p_byte_size: file.size },
  );
  if (reserveError) {
    throw new HttpError(
      503,
      'STORAGE_QUOTA_UNAVAILABLE',
      '사진 저장 한도를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (!reservationId) {
    throw new HttpError(
      413,
      'STORAGE_QUOTA_REACHED',
      '사진 저장 한도에 도달했습니다.',
    );
  }
  const extension =
    file.type === 'image/jpeg'
      ? 'jpg'
      : file.type === 'image/png'
        ? 'png'
        : 'webp';
  const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage
    .from('community-images')
    .upload(objectPath, file, {
      contentType: file.type,
      cacheControl: '300',
      upsert: false,
    });
  if (uploadError) {
    await client.rpc('release_community_media_reservation', {
      p_reservation_id: reservationId,
    });
    throw new HttpError(
      503,
      'STORAGE_UNAVAILABLE',
      '사진 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  const { data: mediaId, error: finalizeError } = await client.rpc(
    'finalize_community_media',
    {
      p_reservation_id: reservationId,
      p_object_path: objectPath,
      p_content_type: file.type,
      p_parent_type: parentType,
      p_parent_id: parentId,
    },
  );
  if (finalizeError || !mediaId) {
    await client.storage.from('community-images').remove([objectPath]);
    await client.rpc('release_community_media_reservation', {
      p_reservation_id: reservationId,
    });
    throw new HttpError(
      500,
      'MEDIA_OPERATION_FAILED',
      '사진 한도 예약을 확정하지 못했습니다.',
    );
  }
  return { mediaId };
}
