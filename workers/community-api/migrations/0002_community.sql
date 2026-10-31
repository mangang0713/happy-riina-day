-- Supabase 커뮤니티 모델을 비공개 API DB 파일럿용으로 옮긴 스키마입니다.
-- 인증·권한 검사는 Worker가 맡고 브라우저에는 DB 접속 역할을 제공하지 않습니다.

-- 로그인 사용자의 공개 닉네임과 현재 개인정보 공개 안내 동의 버전을 보관합니다.
create table if not exists profiles (
  id text primary key references "user" (id) on delete cascade,
  display_name text not null default 'H1-KEY 팬'
    check (char_length(display_name) between 1 and 40),
  community_terms_accepted_at timestamptz,
  community_terms_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 관리자 명단입니다. API가 매 요청마다 확인하며 일반 프로필로 권한을 올릴 수 없습니다.
create table if not exists admin_members (
  user_id text primary key references "user" (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 전역 중단 스위치와 사진 저장 한도를 보관하는 단일 행 설정입니다.
create table if not exists community_settings (
  id boolean primary key default true check (id),
  community_enabled boolean not null default true,
  uploads_enabled boolean not null default true,
  media_views_enabled boolean not null default true,
  storage_limit_bytes bigint not null default 838860800
    check (storage_limit_bytes between 1048576 and 1073741824),
  storage_used_bytes bigint not null default 0 check (storage_used_bytes >= 0),
  storage_reserved_bytes bigint not null default 0 check (storage_reserved_bytes >= 0),
  updated_at timestamptz not null default now()
);
insert into community_settings (id) values (true) on conflict do nothing;

-- 계정별 사진 사용량과 진행 중 업로드 예약량을 분리해 동시 초과 업로드를 막습니다.
create table if not exists user_media_usage (
  user_id text primary key references "user" (id) on delete cascade,
  image_count integer not null default 0 check (image_count >= 0),
  bytes_used bigint not null default 0 check (bytes_used >= 0),
  images_reserved integer not null default 0 check (images_reserved >= 0),
  bytes_reserved bigint not null default 0 check (bytes_reserved >= 0),
  updated_at timestamptz not null default now()
);

-- 공개 방명록입니다. 숨김 상태와 purge 기한은 이의제기·보존 절차에 사용합니다.
create table if not exists guestbook_posts (
  id uuid primary key default gen_random_uuid(),
  user_id text references "user" (id) on delete set null,
  author_name text not null default '익명 사용자'
    check (char_length(author_name) between 1 and 40),
  body text not null check (char_length(body) between 2 and 1200),
  status text not null default 'published'
    check (status in ('published', 'hidden', 'purging')),
  moderation_reason text,
  hidden_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guestbook_published_created_idx
  on guestbook_posts (created_at desc) where status = 'published';
create index if not exists guestbook_expired_hidden_idx
  on guestbook_posts (purge_after) where status = 'hidden';

-- 일정별 좋아요입니다. 계정은 같은 정적 일정 ID에 하나의 반응만 가질 수 있습니다.
create table if not exists schedule_likes (
  id uuid primary key default gen_random_uuid(),
  schedule_id text not null check (char_length(schedule_id) <= 100),
  user_id text not null references "user" (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (schedule_id, user_id)
);
create index if not exists schedule_likes_schedule_idx on schedule_likes (schedule_id);

-- 일정 후기입니다. 일정당 사용자당 한 건을 제한하며 공개 여부는 status로 관리합니다.
create table if not exists schedule_reviews (
  id uuid primary key default gen_random_uuid(),
  schedule_id text not null check (char_length(schedule_id) <= 100),
  user_id text references "user" (id) on delete set null,
  author_name text not null default '익명 사용자'
    check (char_length(author_name) between 1 and 40),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 2 and 1200),
  status text not null default 'published'
    check (status in ('published', 'hidden', 'purging')),
  moderation_reason text,
  hidden_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists schedule_reviews_one_per_user_idx
  on schedule_reviews (schedule_id, user_id) where user_id is not null;
create index if not exists schedule_reviews_published_created_idx
  on schedule_reviews (schedule_id, created_at desc) where status = 'published';
create index if not exists schedule_reviews_expired_hidden_idx
  on schedule_reviews (purge_after) where status = 'hidden';

-- 비공개 R2 객체 경로와 게시물 연결 정보입니다. 공개 URL 대신 Worker가 권한을 검사합니다.
create table if not exists community_media (
  id uuid primary key default gen_random_uuid(),
  owner_id text references "user" (id) on delete set null,
  guestbook_post_id uuid references guestbook_posts (id) on delete cascade,
  schedule_review_id uuid references schedule_reviews (id) on delete cascade,
  object_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 1048576),
  created_at timestamptz not null default now(),
  constraint community_media_one_parent check (
    (guestbook_post_id is null) <> (schedule_review_id is null)
  )
);
create index if not exists community_media_guestbook_idx
  on community_media (guestbook_post_id) where guestbook_post_id is not null;
create index if not exists community_media_review_idx
  on community_media (schedule_review_id) where schedule_review_id is not null;

-- 관리자 신고 대기열입니다. 원글 일부와 작성자 이름을 스냅샷으로 남겨 처리 근거를 보존합니다.
create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text references "user" (id) on delete set null,
  content_type text not null check (content_type in ('guestbook', 'review')),
  content_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 80),
  details text check (details is null or char_length(details) <= 500),
  target_excerpt text not null check (char_length(target_excerpt) <= 500),
  target_author text not null check (char_length(target_author) <= 40),
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, content_type, content_id)
);
create index if not exists content_reports_open_idx
  on content_reports (created_at) where status = 'open';

-- R2 저장 전 용량 예약입니다. 실패·만료 시 계정 및 전역 예약량을 돌려줍니다.
create table if not exists media_quota_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" (id) on delete cascade,
  byte_size integer not null check (byte_size between 1 and 1048576),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

-- 계정별 요청 횟수 제한입니다. 익명 IP 제한에는 원 IP 대신 해시를 저장합니다.
create table if not exists community_rate_limits (
  user_id text not null references "user" (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, action, window_start)
);
create table if not exists community_public_rate_limits (
  ip_hash text not null,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (ip_hash, action, window_start)
);

-- 숨김 결정에 대한 작성자 이의제기와 관리자 판정 이력을 보존합니다.
create table if not exists content_appeals (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('guestbook', 'review')),
  content_id uuid not null,
  author_id text references "user" (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 1000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_reason text check (decision_reason is null or char_length(decision_reason) <= 1000)
);
create unique index if not exists content_appeals_one_pending_idx
  on content_appeals (content_type, content_id) where status = 'pending';
create index if not exists content_appeals_pending_idx
  on content_appeals (submitted_at) where status = 'pending';
create index if not exists content_appeals_author_idx
  on content_appeals (author_id, submitted_at desc);

-- 기각 후 글·사진을 지워도 결정 사유는 작성자에게 7일간 안내합니다.
create table if not exists content_appeal_results (
  id uuid primary key default gen_random_uuid(),
  author_id text not null references "user" (id) on delete cascade,
  content_type text not null check (content_type in ('guestbook', 'review')),
  content_created_at timestamptz not null,
  decision_reason text not null check (char_length(decision_reason) between 1 and 1000),
  decided_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists content_appeal_results_author_expiry_idx
  on content_appeal_results (author_id, expires_at desc);
create index if not exists content_appeal_results_expiry_idx
  on content_appeal_results (expires_at);

-- 익명 DB 권한을 부여하지 않습니다. 운영에서는 마이그레이션 역할과 API 역할을 따로 구성하고
-- 사용자·관리자 권한 검사는 Hono 요청 경계에서 수행합니다.
revoke all on all tables in schema public from public;
