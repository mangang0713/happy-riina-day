-- 인증 파일럿 전용 스키마입니다. Better Auth 기본 모델의 컬럼 대소문자를 유지합니다.
-- 로컬·파일럿 DB에만 적용하며 운영 Supabase에는 실행하지 않습니다.

-- 사용자 기본 정보입니다. 공개 닉네임과 동의 상태는 커뮤니티 profiles에서 별도 관리합니다.
create table if not exists "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- 브라우저 로그인 상태와 만료 시각을 저장합니다. 사용자 삭제 시 세션도 함께 삭제됩니다.
create table if not exists session (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" (id) on delete cascade
);
create index if not exists session_user_id_idx on session ("userId");

-- OAuth provider의 불변 계정 ID를 사용자에 연결합니다. 토큰은 서버에서 암호화해 보관합니다.
create table if not exists account (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" (id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("providerId", "accountId")
);
create index if not exists account_user_id_idx on account ("userId");

-- 이메일이 없는 provider의 내부 식별값 등 인증 확인용 임시 값을 보관합니다.
create table if not exists verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists verification_identifier_idx on verification (identifier);
