/**
 * 이 Edge Function은 커뮤니티 API 요청의 인증·권한·약관·속도 제한을 확인하고 기능 모듈로 전달합니다.
 */

import {
  createClient,
  type SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';
import {
  deleteCommunityContent,
  deleteCommunityMedia,
  signedMedia,
  allowMediaRequest,
  uploadImage,
} from './media.ts';
import {
  attachModerationDetails,
  purgeExpiredCommunityContent,
  removeStorageObjectsForContent,
  safeSecretEquals,
} from './moderation.ts';
import { createHttpHelpers, getBearer, HttpError, text } from './http.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
const communityTermsVersion = '2026-10-21-v2';
const allowedOrigins = new Set(
  (
    Deno.env.get('ALLOWED_ORIGINS') ??
    'http://localhost:5173,http://127.0.0.1:5173,https://mangang0713.github.io'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const { corsHeaders, respond } = createHttpHelpers(allowedOrigins);

const admin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

/** 로그인 토큰을 Supabase에서 검증하고 사용자용·서버용 클라이언트를 제공합니다. */
async function requireUser(request: Request) {
  if (!supabaseUrl || !anonKey || !admin) {
    throw new HttpError(
      503,
      'SERVER_CONFIGURATION_MISSING',
      'Supabase 서버 설정이 완료되지 않았습니다.',
    );
  }
  const token = getBearer(request);
  if (!token) {
    throw new HttpError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  }
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  let data: Awaited<ReturnType<typeof client.auth.getUser>>['data'];
  let error: Awaited<ReturnType<typeof client.auth.getUser>>['error'];
  try {
    ({ data, error } = await client.auth.getUser(token));
  } catch {
    throw new HttpError(
      503,
      'AUTH_SERVICE_UNAVAILABLE',
      '로그인 확인 서버에 연결하지 못했습니다.',
    );
  }
  if (error || !data.user) {
    const status = (error as { status?: number } | null)?.status;
    if (error && (!status || status < 400 || status >= 500 || status === 429)) {
      throw new HttpError(
        503,
        'AUTH_SERVICE_UNAVAILABLE',
        '로그인 확인 서버에 연결하지 못했습니다.',
      );
    }
    throw new HttpError(
      401,
      'INVALID_SESSION',
      '로그인 세션을 확인할 수 없습니다.',
    );
  }
  return { user: data.user, client, admin };
}

/** 사용자 기능의 공개 상태와 사진 저장 한도를 데이터베이스에서 확인합니다. */
async function settings(client: SupabaseClient) {
  const { data, error } = await client
    .from('community_settings')
    .select(
      'community_enabled, uploads_enabled, media_views_enabled, storage_used_bytes, storage_limit_bytes',
    )
    .eq('id', true)
    .single();
  if (error || !data) throw new Error('커뮤니티 설정을 확인하지 못했습니다.');
  return data;
}

/** 관리자 여부를 확인한 뒤 원격 중단 스위치와 서비스 사용량을 반환합니다. */
async function adminSettings(client: SupabaseClient, userId: string) {
  if (!(await isAdmin(client, userId))) {
    throw new Error('관리자만 운영 설정을 볼 수 있습니다.');
  }
  const { data, error } = await client
    .from('community_settings')
    .select(
      'community_enabled, uploads_enabled, media_views_enabled, storage_used_bytes, storage_limit_bytes',
    )
    .eq('id', true)
    .single();
  if (error || !data) throw new Error('운영 설정을 불러오지 못했습니다.');
  const { data: databaseBytes } = await client.rpc('get_database_size_bytes');
  return {
    ...data,
    database_used_bytes: Number(databaseBytes ?? 0),
    database_warning_bytes: 350 * 1024 * 1024,
    database_stop_bytes: 400 * 1024 * 1024,
    egress_warning_bytes: Math.round(3.5 * 1024 ** 3),
    egress_stop_bytes: 4 * 1024 ** 3,
  };
}

/** 신규 사용자 쓰기 전에 중단 스위치와 DB 안전 상한을 확인합니다. */
async function assertCommunityEnabled(client: SupabaseClient) {
  const current = await settings(client);
  if (!current.community_enabled) {
    throw new Error(
      '사용자 기능을 잠시 중단했습니다. 지도와 일정 기록은 계속 볼 수 있습니다.',
    );
  }
  const { data: databaseBytes, error } = await client.rpc(
    'get_database_size_bytes',
  );
  if (error) throw new Error('데이터베이스 사용량을 확인하지 못했습니다.');
  if (Number(databaseBytes) >= 400 * 1024 * 1024) {
    throw new Error(
      '데이터베이스 사용량이 안전 한도에 도달해 사용자 기능 쓰기를 잠시 중단했습니다.',
    );
  }
  return current;
}

/** 계정별 작업 요청 횟수를 차감해 반복 제출을 제한합니다. */
async function takeLimit(
  client: SupabaseClient,
  userId: string,
  action: string,
  limit: number,
  seconds = 60,
) {
  const { data, error } = await client.rpc('consume_community_rate_limit', {
    p_user_id: userId,
    p_action: action,
    p_limit: limit,
    p_window_seconds: seconds,
  });
  if (error) {
    throw new HttpError(
      503,
      'RATE_LIMIT_UNAVAILABLE',
      '요청 횟수를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (!data) {
    throw new HttpError(
      429,
      'RATE_LIMIT_EXCEEDED',
      '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
}

/** 게시·신고 요청의 봇 확인 토큰을 Cloudflare에서 검증합니다. */
async function verifyTurnstile(request: Request, token: unknown) {
  if (!turnstileSecret) {
    throw new HttpError(
      503,
      'BOT_CHECK_UNAVAILABLE',
      '봇 확인 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (typeof token !== 'string' || token.length < 10) {
    throw new HttpError(400, 'BOT_CHECK_REQUIRED', '봇 확인을 완료해 주세요.');
  }
  const form = new FormData();
  form.set('secret', turnstileSecret);
  form.set('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.set('remoteip', ip);
  let response: Response;
  try {
    response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    throw new HttpError(
      503,
      'BOT_CHECK_UNAVAILABLE',
      '봇 확인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (!response.ok) {
    console.error('Turnstile Siteverify returned a non-success status', {
      status: response.status,
    });
    throw new HttpError(
      503,
      'BOT_CHECK_UNAVAILABLE',
      '봇 확인 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  let result: { success?: boolean; hostname?: string };
  try {
    result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
    };
  } catch {
    throw new HttpError(
      503,
      'BOT_CHECK_UNAVAILABLE',
      '봇 확인 서버의 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  const allowedHosts = new Set(
    [...allowedOrigins].map((value) => new URL(value).hostname),
  );
  if (
    !result.success ||
    !result.hostname ||
    !allowedHosts.has(result.hostname)
  ) {
    throw new HttpError(
      403,
      'BOT_CHECK_FAILED',
      '봇 확인에 실패했습니다. 다시 시도해 주세요.',
    );
  }
}

/** 공개 커뮤니티 글에서 사용할 최신 프로필 표시 이름을 조회합니다. */
async function profileName(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single();
  if (error || !data) throw new Error('공개 표시 이름을 불러오지 못했습니다.');
  return String(data.display_name);
}

/** 사용자 공개 동의 시점과 문서 버전을 계정에 기록합니다. */
async function acceptCommunityTerms(client: SupabaseClient, userId: string) {
  const { error } = await client
    .from('profiles')
    .update({
      community_terms_accepted_at: new Date().toISOString(),
      community_terms_version: communityTermsVersion,
    })
    .eq('id', userId);
  if (error) throw new Error('공개 안내 동의를 저장하지 못했습니다.');
}

/** 글 작성·사진 업로드 전에 최신 공개 안내 동의가 있는지 확인합니다. */
async function requireCommunityTerms(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('profiles')
    .select('community_terms_version')
    .eq('id', userId)
    .single();
  if (error || data?.community_terms_version !== communityTermsVersion) {
    throw new Error('게시물과 사진 공개 안내를 확인하고 동의해 주세요.');
  }
}

/** 데이터베이스의 보호된 권한을 확인하고 요청자의 운영자 여부를 반환합니다. */
async function isAdmin(client: SupabaseClient, userId: string) {
  const { data, error } = await client.rpc('is_archive_admin_user', {
    p_user_id: userId,
  });
  if (error) throw new Error('관리자 권한을 확인하지 못했습니다.');
  return data === true;
}

// action별 요청을 인증·검증한 뒤 방명록, 후기, 신고, 운영 기능으로 전달합니다.
Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return respond({ error: 'POST 요청만 허용됩니다.' }, 405, origin);
  }
  if (origin && !allowedOrigins.has(origin)) {
    return respond({ error: '허용되지 않은 도메인입니다.' }, 403, origin);
  }
  try {
    if (!admin) {
      throw new Error('Supabase Edge Function 비밀 설정을 확인해 주세요.');
    }
    const contentType = request.headers.get('content-type') ?? '';
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (
      contentType.includes('multipart/form-data') &&
      contentLength > 1250000
    ) {
      return respond(
        {
          error: '업로드 요청이 너무 큽니다. 사진을 줄여서 다시 시도해 주세요.',
        },
        413,
        origin,
      );
    }
    const form = contentType.includes('multipart/form-data')
      ? await request.formData()
      : null;
    const rawBody = form
      ? Object.fromEntries(
          [...form.entries()].filter(([, value]) => typeof value === 'string'),
        )
      : await request.json();
    const action = form?.get('action') ?? rawBody.action;
    if (action === 'signed-media') {
      if (!(await allowMediaRequest(request, admin))) {
        return respond(
          { error: '사진 요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.' },
          429,
          origin,
        );
      }
      return respond(
        await signedMedia(admin, rawBody.mediaIds, settings),
        200,
        origin,
      );
    }
    if (action === 'purge-expired-content') {
      const expectedSecret = Deno.env.get('COMMUNITY_PURGE_SECRET') ?? '';
      const receivedSecret =
        request.headers.get('x-community-purge-secret') ?? '';
      if (!safeSecretEquals(receivedSecret, expectedSecret)) {
        return respond(
          { error: '예약 정리 요청을 인증하지 못했습니다.' },
          403,
          origin,
        );
      }
      const result = await purgeExpiredCommunityContent(admin);
      return respond(result, result.failed ? 500 : 200, origin);
    }
    const { user } = await requireUser(request);
    if (action === 'accept-community-terms') {
      await acceptCommunityTerms(admin, user.id);
      return respond(
        { accepted: true, version: communityTermsVersion },
        200,
        origin,
      );
    }
    if (form && action === 'upload-image') {
      return respond(
        await uploadImage(request, user.id, admin, form, {
          assertCommunityEnabled,
          requireCommunityTerms,
          takeLimit,
        }),
        200,
        origin,
      );
    }
    const adminClient = admin;
    const userId = user.id;

    if (action === 'get-admin-settings') {
      return respond(await adminSettings(adminClient, userId), 200, origin);
    }
    if (action === 'get-admin-reports') {
      if (!(await isAdmin(adminClient, userId))) {
        throw new Error('관리자만 신고 목록을 볼 수 있습니다.');
      }
      const { data, error } = await adminClient
        .from('content_reports')
        .select(
          'id, content_type, content_id, reason, details, status, created_at, target_excerpt, target_author',
        )
        .eq('status', 'open')
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw new Error('신고 목록을 불러오지 못했습니다.');
      return respond(data ?? [], 200, origin);
    }
    if (action === 'get-admin-hidden-content') {
      await takeLimit(
        adminClient,
        userId,
        'get-admin-hidden-content',
        60,
        3600,
      );
      if (!(await isAdmin(adminClient, userId))) {
        throw new Error('관리자만 숨김 게시물을 볼 수 있습니다.');
      }
      const [guestbookResult, reviewResult] = await Promise.all([
        adminClient
          .from('guestbook_posts')
          .select(
            'id, author_name, body, created_at, status, moderation_reason, hidden_at, purge_after',
          )
          .eq('status', 'hidden')
          .order('hidden_at', { ascending: false })
          .limit(100),
        adminClient
          .from('schedule_reviews')
          .select(
            'id, schedule_id, author_name, body, rating, created_at, status, moderation_reason, hidden_at, purge_after',
          )
          .eq('status', 'hidden')
          .order('hidden_at', { ascending: false })
          .limit(100),
      ]);
      if (guestbookResult.error || reviewResult.error) {
        throw new Error('숨김 게시물을 불러오지 못했습니다.');
      }
      const hidden = [
        ...(guestbookResult.data ?? []).map((item) => ({
          ...item,
          content_type: 'guestbook' as const,
          schedule_id: null,
          rating: null,
        })),
        ...(reviewResult.data ?? []).map((item) => ({
          ...item,
          content_type: 'review' as const,
        })),
      ]
        .sort((a, b) =>
          (b.hidden_at ?? b.created_at).localeCompare(
            a.hidden_at ?? a.created_at,
          ),
        )
        .slice(0, 100);
      return respond(
        await attachModerationDetails(adminClient, hidden),
        200,
        origin,
      );
    }
    if (action === 'get-my-content') {
      await takeLimit(adminClient, userId, 'get-my-content', 60, 3600);
      const [guestbookResult, reviewResult, appealResultsResult] =
        await Promise.all([
          adminClient
            .from('guestbook_posts')
            .select(
              'id, author_name, body, created_at, status, moderation_reason, hidden_at, purge_after',
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100),
          adminClient
            .from('schedule_reviews')
            .select(
              'id, schedule_id, author_name, body, rating, created_at, status, moderation_reason, hidden_at, purge_after',
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100),
          adminClient
            .from('content_appeal_results')
            .select(
              'id, content_type, content_created_at, decision_reason, decided_at, expires_at',
            )
            .eq('author_id', userId)
            .gt('expires_at', new Date().toISOString())
            .order('decided_at', { ascending: false })
            .limit(100),
        ]);
      if (
        guestbookResult.error ||
        reviewResult.error ||
        appealResultsResult.error
      ) {
        throw new Error('내 게시글을 불러오지 못했습니다.');
      }
      const ownContent = [
        ...(guestbookResult.data ?? []).map((item) => ({
          ...item,
          content_type: 'guestbook' as const,
          schedule_id: null,
          rating: null,
        })),
        ...(reviewResult.data ?? []).map((item) => ({
          ...item,
          content_type: 'review' as const,
        })),
      ]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 100);
      return respond(
        {
          posts: await attachModerationDetails(adminClient, ownContent),
          appealResults: appealResultsResult.data ?? [],
        },
        200,
        origin,
      );
    }
    if (action === 'restore-hidden-content') {
      if (!(await isAdmin(adminClient, userId))) {
        throw new Error('관리자만 숨김 게시물을 복원할 수 있습니다.');
      }
      const contentType = rawBody.contentType;
      if (contentType !== 'guestbook' && contentType !== 'review') {
        throw new Error('복원할 게시물 종류가 올바르지 않습니다.');
      }
      const table =
        contentType === 'guestbook' ? 'guestbook_posts' : 'schedule_reviews';
      const now = new Date().toISOString();
      const { data, error } = await adminClient
        .from(table)
        .update({
          status: 'published',
          moderation_reason: null,
          hidden_at: null,
          purge_after: null,
          updated_at: now,
        })
        .eq('id', text(rawBody.contentId, 100))
        .eq('status', 'hidden')
        .select('id')
        .maybeSingle();
      if (error || !data) {
        throw new Error(
          '숨김 게시물을 복원하지 못했습니다. 다시 목록을 불러와 확인해 주세요.',
        );
      }
      await adminClient
        .from('content_appeals')
        .update({
          status: 'approved',
          decided_at: now,
          decision_reason: '관리자 검토 후 게시물이 복원되었습니다.',
        })
        .eq('content_type', contentType)
        .eq('content_id', data.id)
        .eq('status', 'pending');
      return respond({ restored: true }, 200, origin);
    }
    if (action === 'update-admin-settings') {
      if (!(await isAdmin(adminClient, userId))) {
        throw new Error('관리자만 운영 설정을 바꿀 수 있습니다.');
      }
      const next = rawBody.settings;
      if (
        !next ||
        Object.keys(next).some(
          (key) =>
            ![
              'community_enabled',
              'uploads_enabled',
              'media_views_enabled',
            ].includes(key),
        ) ||
        Object.values(next).some((value) => typeof value !== 'boolean')
      ) {
        throw new Error('운영 설정 형식이 올바르지 않습니다.');
      }
      const { error } = await adminClient
        .from('community_settings')
        .update({ ...next, updated_at: new Date().toISOString() })
        .eq('id', true);
      if (error) throw new Error('운영 설정을 저장하지 못했습니다.');
      return respond({ saved: true }, 200, origin);
    }

    const captchaActions = new Set([
      'create-guestbook',
      'edit-guestbook',
      'create-review',
      'edit-review',
    ]);
    if (captchaActions.has(String(action))) {
      await verifyTurnstile(request, rawBody.turnstileToken);
    }
    if (
      ![
        'moderate-report',
        'get-admin-settings',
        'update-admin-settings',
        'get-admin-reports',
        'get-admin-hidden-content',
        'get-my-content',
        'restore-hidden-content',
        'resolve-appeal',
        'submit-appeal',
        'hide-content',
        'delete-content',
        'delete-media',
        'delete-account',
      ].includes(String(action))
    ) {
      await assertCommunityEnabled(adminClient);
    }

    if (action === 'create-guestbook') {
      await requireCommunityTerms(adminClient, userId);
      await takeLimit(adminClient, userId, 'create-guestbook', 10, 3600);
      const body = text(rawBody.body, 1200);
      const author = await profileName(adminClient, userId);
      const { data, error } = await adminClient
        .from('guestbook_posts')
        .insert({ user_id: userId, author_name: author, body })
        .select('id')
        .single();
      if (error) throw new Error('방명록 글을 저장하지 못했습니다.');
      return respond({ id: data.id }, 200, origin);
    }
    if (action === 'edit-guestbook') {
      await requireCommunityTerms(adminClient, userId);
      await takeLimit(adminClient, userId, 'edit-guestbook', 8, 3600);
      const { data, error } = await adminClient
        .from('guestbook_posts')
        .update({
          body: text(rawBody.body, 1200),
          updated_at: new Date().toISOString(),
        })
        .eq('id', rawBody.postId)
        .eq('user_id', userId)
        .eq('status', 'published')
        .select('id')
        .maybeSingle();
      if (error || !data) {
        throw new Error('본인의 공개 상태 게시물만 수정할 수 있습니다.');
      }
      return respond({ id: rawBody.postId }, 200, origin);
    }
    if (action === 'create-review' || action === 'edit-review') {
      await requireCommunityTerms(adminClient, userId);
      await takeLimit(adminClient, userId, 'save-review', 5, 3600);
      const scheduleId = text(rawBody.scheduleId, 100);
      const body = text(rawBody.body, 1200);
      const rating = Number(rawBody.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('별점은 1~5점으로 선택해 주세요.');
      }
      const author = await profileName(adminClient, userId);
      if (action === 'edit-review') {
        const { data, error } = await adminClient
          .from('schedule_reviews')
          .update({ body, rating, updated_at: new Date().toISOString() })
          .eq('id', rawBody.reviewId)
          .eq('user_id', userId)
          .eq('status', 'published')
          .select('id')
          .maybeSingle();
        if (error || !data) {
          throw new Error('본인의 공개 상태 후기만 수정할 수 있습니다.');
        }
        return respond({ id: rawBody.reviewId }, 200, origin);
      }
      const { data, error } = await adminClient
        .from('schedule_reviews')
        .insert({
          schedule_id: scheduleId,
          user_id: userId,
          author_name: author,
          body,
          rating,
        })
        .select('id')
        .single();
      if (error) {
        throw new Error(
          '일정당 후기 하나만 작성할 수 있습니다. 기존 후기를 수정해 주세요.',
        );
      }
      return respond({ id: data.id }, 200, origin);
    }
    if (action === 'toggle-like') {
      await takeLimit(adminClient, userId, 'toggle-like', 30, 3600);
      const scheduleId = text(rawBody.scheduleId, 100);
      const { data: existing } = await adminClient
        .from('schedule_likes')
        .select('id')
        .eq('schedule_id', scheduleId)
        .eq('user_id', userId)
        .maybeSingle();
      if (existing) {
        const { error } = await adminClient
          .from('schedule_likes')
          .delete()
          .eq('id', existing.id);
        if (error) throw new Error('좋아요를 취소하지 못했습니다.');
        return respond({ liked: false }, 200, origin);
      }
      const { error } = await adminClient
        .from('schedule_likes')
        .insert({ schedule_id: scheduleId, user_id: userId });
      if (error) throw new Error('좋아요를 저장하지 못했습니다.');
      return respond({ liked: true }, 200, origin);
    }
    if (action === 'delete-content') {
      await takeLimit(adminClient, userId, 'delete-content', 10, 3600);
      const contentType = rawBody.contentType;
      if (contentType !== 'guestbook' && contentType !== 'review') {
        throw new Error('삭제할 게시물 종류가 올바르지 않습니다.');
      }
      await deleteCommunityContent(
        adminClient,
        contentType,
        text(rawBody.contentId, 100),
        userId,
      );
      return respond({ deleted: true }, 200, origin);
    }
    if (action === 'hide-content') {
      await takeLimit(adminClient, userId, 'hide-content', 20, 3600);
      if (!(await isAdmin(adminClient, userId))) {
        throw new Error('관리자만 게시물을 숨길 수 있습니다.');
      }
      const contentType = rawBody.contentType;
      if (contentType !== 'guestbook' && contentType !== 'review') {
        throw new Error('숨길 게시물 종류가 올바르지 않습니다.');
      }
      const table =
        contentType === 'guestbook' ? 'guestbook_posts' : 'schedule_reviews';
      const contentId = text(rawBody.contentId, 100);
      const reason = text(rawBody.reason, 1000);
      const now = new Date();
      const { data, error } = await adminClient
        .from(table)
        .update({
          status: 'hidden',
          moderation_reason: reason,
          hidden_at: now.toISOString(),
          purge_after: new Date(
            now.getTime() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', contentId)
        .eq('status', 'published')
        .select('id')
        .maybeSingle();
      if (error || !data) {
        throw new Error(
          '공개 게시물을 숨기지 못했습니다. 이미 숨겨졌거나 삭제된 글인지 확인해 주세요.',
        );
      }
      const { error: reportCleanupError } = await adminClient
        .from('content_reports')
        .update({ status: 'actioned' })
        .eq('content_type', contentType)
        .eq('content_id', data.id)
        .eq('status', 'open');
      if (reportCleanupError) {
        throw new Error(
          '게시물은 숨겼지만 연결된 신고 처리를 갱신하지 못했습니다.',
        );
      }
      return respond(
        {
          hidden: true,
          purgeAfter: new Date(
            now.getTime() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        200,
        origin,
      );
    }
    if (action === 'submit-appeal') {
      await takeLimit(adminClient, userId, 'submit-appeal', 3, 86400);
      const contentType = rawBody.contentType;
      if (contentType !== 'guestbook' && contentType !== 'review') {
        throw new Error('이의제기 게시물 종류가 올바르지 않습니다.');
      }
      const contentId = text(rawBody.contentId, 100);
      const reason = text(rawBody.reason, 1000);
      const { data, error } = await adminClient.rpc(
        'submit_community_content_appeal',
        {
          p_content_type: contentType,
          p_content_id: contentId,
          p_author_id: userId,
          p_reason: reason,
        },
      );
      if (error) {
        throw new Error('이미 이의제기를 제출했거나 저장하지 못했습니다.');
      }
      return respond({ submitted: true, appealId: data }, 200, origin);
    }
    if (action === 'resolve-appeal') {
      if (!(await isAdmin(adminClient, userId))) {
        throw new Error('관리자만 이의제기를 검토할 수 있습니다.');
      }
      const decision = rawBody.decision;
      if (decision !== 'approve' && decision !== 'reject') {
        throw new Error('이의제기 처리 방식이 올바르지 않습니다.');
      }
      const appealId = text(rawBody.appealId, 100);
      const { data: appeal, error: appealError } = await adminClient
        .from('content_appeals')
        .select('*')
        .eq('id', appealId)
        .maybeSingle();
      if (appealError || !appeal || appeal.status !== 'pending') {
        throw new Error('검토 대기 중인 이의제기를 찾지 못했습니다.');
      }
      const decisionReason =
        decision === 'reject'
          ? text(rawBody.reason, 1000)
          : typeof rawBody.reason === 'string'
            ? rawBody.reason.trim().slice(0, 1000) || null
            : null;
      if (decision === 'reject') {
        if (!decisionReason) throw new Error('기각 사유를 작성해 주세요.');
        await removeStorageObjectsForContent(
          adminClient,
          appeal.content_type,
          appeal.content_id,
        );
      }
      const { data, error } = await adminClient.rpc(
        'resolve_community_content_appeal',
        {
          p_appeal_id: appealId,
          p_decision: decision,
          p_decision_reason: decisionReason,
        },
      );
      if (error || !data) {
        throw new Error(
          decision === 'approve'
            ? '게시물을 복원하지 못해 이의제기를 처리하지 못했습니다.'
            : '게시글과 사진을 삭제하고 결과를 저장하지 못했습니다. 다시 시도해 주세요.',
        );
      }
      return respond({ resolved: true, ...data }, 200, origin);
    }
    if (action === 'delete-media') {
      await takeLimit(adminClient, userId, 'delete-media', 20, 3600);
      await deleteCommunityMedia(
        adminClient,
        text(rawBody.mediaId, 100),
        userId,
        isAdmin,
      );
      return respond({ deleted: true }, 200, origin);
    }
    if (action === 'report-content') {
      await takeLimit(adminClient, userId, 'report-content', 5, 86400);
      const contentType = rawBody.contentType;
      if (contentType !== 'guestbook' && contentType !== 'review') {
        throw new Error('신고 대상이 올바르지 않습니다.');
      }
      const table =
        contentType === 'guestbook' ? 'guestbook_posts' : 'schedule_reviews';
      const { data: target, error: targetError } = await adminClient
        .from(table)
        .select('body, author_name, status, user_id')
        .eq('id', rawBody.contentId)
        .maybeSingle();
      if (targetError || !target || target.status !== 'published') {
        throw new Error('신고할 공개 게시물을 찾지 못했습니다.');
      }
      if (target.user_id === userId) {
        throw new Error('본인 게시물은 신고할 수 없습니다.');
      }
      const reason = text(rawBody.reason, 80);
      const details =
        typeof rawBody.details === 'string' && rawBody.details.trim()
          ? rawBody.details.trim().slice(0, 500)
          : null;
      const { error } = await adminClient.from('content_reports').insert({
        reporter_id: userId,
        content_type: contentType,
        content_id: rawBody.contentId,
        reason,
        details,
        target_excerpt: target.body.slice(0, 500),
        target_author: target.author_name,
      });
      if (error) throw new Error('이미 신고했거나 신고를 저장하지 못했습니다.');
      return respond({ reported: true }, 200, origin);
    }
    if (action === 'update-profile') {
      await takeLimit(adminClient, userId, 'update-profile', 5, 3600);
      const displayName = text(rawBody.displayName, 40);
      const { error } = await adminClient
        .from('profiles')
        .update({
          display_name: displayName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (error) throw new Error('표시 이름을 저장하지 못했습니다.');
      return respond({ saved: true }, 200, origin);
    }
    if (action === 'moderate-report') {
      if (!(await isAdmin(adminClient, userId))) {
        throw new Error('관리자만 신고를 처리할 수 있습니다.');
      }
      const decision = rawBody.decision;
      if (!['dismiss', 'hide'].includes(decision)) {
        throw new Error('신고 처리 방식이 올바르지 않습니다.');
      }
      const { data: report, error: reportError } = await adminClient
        .from('content_reports')
        .select('*')
        .eq('id', rawBody.reportId)
        .single();
      if (reportError) throw new Error('신고 내역을 찾지 못했습니다.');
      if (decision === 'dismiss') {
        const { error } = await adminClient
          .from('content_reports')
          .update({ status: 'dismissed' })
          .eq('id', report.id);
        if (error) throw new Error('신고 기각을 저장하지 못했습니다.');
      } else if (decision === 'hide') {
        const reason = text(rawBody.reason, 1000);
        const table =
          report.content_type === 'guestbook'
            ? 'guestbook_posts'
            : 'schedule_reviews';
        const { data: content, error: readContentError } = await adminClient
          .from(table)
          .select('id, status')
          .eq('id', report.content_id)
          .maybeSingle();
        if (readContentError || !content) {
          throw new Error('신고 대상 게시물을 찾지 못했습니다.');
        }
        let contentError = null;
        if (content.status === 'published') {
          const now = new Date();
          const { error } = await adminClient
            .from(table)
            .update({
              status: 'hidden',
              moderation_reason: reason,
              hidden_at: now.toISOString(),
              purge_after: new Date(
                now.getTime() + 7 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('id', content.id);
          contentError = error;
        }
        const { error: reportError } = await adminClient
          .from('content_reports')
          .update({ status: 'actioned' })
          .eq('content_type', report.content_type)
          .eq('content_id', report.content_id)
          .eq('status', 'open');
        if (contentError || reportError) {
          throw new Error('신고 숨김 처리를 저장하지 못했습니다.');
        }
      }
      return respond({ processed: true }, 200, origin);
    }
    if (action === 'delete-account') {
      await takeLimit(adminClient, userId, 'delete-account', 1, 86400);
      const { error: appealCleanupError } = await adminClient
        .from('content_appeals')
        .delete()
        .eq('author_id', userId);
      if (appealCleanupError) {
        throw new Error('계정에 연결된 이의제기 기록을 정리하지 못했습니다.');
      }
      const { data: media, error: mediaError } = await adminClient
        .from('community_media')
        .select('object_path, byte_size')
        .eq('owner_id', userId);
      if (mediaError) throw new Error('계정 사진을 확인하지 못했습니다.');
      if (media?.length) {
        const { error } = await adminClient.storage
          .from('community-images')
          .remove(media.map((item) => item.object_path));
        if (error) throw new Error('계정 사진 파일을 지우지 못했습니다.');
        for (const item of media) {
          await adminClient.rpc('release_community_media', {
            p_user_id: userId,
            p_byte_size: item.byte_size,
          });
        }
        await adminClient
          .from('community_media')
          .delete()
          .eq('owner_id', userId);
      }
      await adminClient
        .from('guestbook_posts')
        .update({ user_id: null, author_name: '익명 사용자' })
        .eq('user_id', userId);
      await adminClient
        .from('schedule_reviews')
        .update({ user_id: null, author_name: '익명 사용자' })
        .eq('user_id', userId);
      await adminClient.from('schedule_likes').delete().eq('user_id', userId);
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw new Error('계정을 삭제하지 못했습니다.');
      return respond({ deleted: true }, 200, origin);
    }
    return respond({ error: '지원하지 않는 요청입니다.' }, 400, origin);
  } catch (error) {
    if (error instanceof HttpError) {
      return respond(
        { code: error.code, error: error.message },
        error.status,
        origin,
      );
    }
    return respond(
      {
        error:
          error instanceof Error
            ? error.message
            : '요청을 처리하지 못했습니다.',
      },
      400,
      origin,
    );
  }
});
