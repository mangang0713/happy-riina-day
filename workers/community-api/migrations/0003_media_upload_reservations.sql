-- 진행 중 예약에도 부모 글과 R2 경로를 기록합니다. 동시 요청에서 글당 사진 3장 제한을
-- 지키고 예약 만료 때 R2에 남은 고아 파일을 정리하기 위한 로컬 파일럿 변경입니다.
-- 운영 Supabase 원격 DB에는 적용하지 않습니다.

alter table media_quota_reservations
  add column if not exists parent_type text,
  add column if not exists parent_id uuid,
  add column if not exists object_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_quota_reservations_parent_check'
      and conrelid = 'media_quota_reservations'::regclass
  ) then
    alter table media_quota_reservations
      add constraint media_quota_reservations_parent_check
      check (
        (parent_type is null and parent_id is null)
        or (parent_type in ('guestbook', 'review') and parent_id is not null)
      );
  end if;
end $$;

create unique index if not exists media_quota_reservations_object_path_idx
  on media_quota_reservations (object_path) where object_path is not null;
create index if not exists media_quota_reservations_expiry_idx
  on media_quota_reservations (expires_at);
create index if not exists media_quota_reservations_parent_idx
  on media_quota_reservations (parent_type, parent_id, expires_at)
  where parent_id is not null;
