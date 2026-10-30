# Supabase 커뮤니티 기능 설정

Supabase 프로젝트의 커뮤니티 DB 마이그레이션과 `community-api` Edge Function을 적용했고, Turnstile도 연결했습니다. GitHub Pages 빌드에는 GitHub 저장소의 Actions 변수로 Supabase와 Turnstile 공개 설정을 전달합니다. 2026-10-21에는 공개 배포본의 방명록 조회를, 2026-10-29에는 로그인 후 방명록·후기 작성과 삭제를 확인했습니다. 2026-10-30에는 보안 오류 처리 개선본을 `community-api` version 12로 배포하고 잘못된 요청 형식과 비로그인 요청의 오류 응답을 확인했습니다. 모든 커뮤니티 흐름의 재검증은 출시 전에 필요합니다. 설정이나 커뮤니티 기능에 문제가 있어도 지도와 정적 일정은 계속 동작합니다. 이 문서는 DB와 서버 기능의 배포·운영 절차를 정리합니다.

## 배포 전 준비

1. 로컬 개발에서는 연결된 Supabase 프로젝트의 URL과 publishable key를 `.env.local`에 넣습니다. `.env.example`을 참고해 시작할 수 있습니다. GitHub Pages 배포에는 저장소 **Settings → Secrets and variables → Actions → Variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY`를 등록합니다. 배포 workflow가 이 변수들을 빌드에 전달합니다. URL, publishable key, Turnstile site key는 브라우저에서 사용되는 공개 설정값입니다. `service_role` 키와 `TURNSTILE_SECRET_KEY`는 절대 `VITE_` 변수나 브라우저 번들에 넣지 말고 서버 secret으로만 보관합니다.
2. Supabase Auth의 사이트 URL과 Redirect URLs에 `http://localhost:5173/`, `http://127.0.0.1:5173/`, `https://mangang0713.github.io/happy-riina-day/`를 등록합니다.
3. X OAuth 2.0, Google, Kakao 제공자 자격 증명을 Supabase Auth에 설정합니다. X는 로그인에만 사용하며 X 게시물을 자동 수집하지 않습니다. OAuth 제공자가 요구하는 공개 개인정보 안내와 이용약관 URL은 정책 문서를 최종 검토한 뒤 등록합니다.
4. Cloudflare Turnstile 사이트 키는 공개 값이므로 로컬 `.env.local`과 GitHub Actions 저장소 변수 `VITE_TURNSTILE_SITE_KEY`에 둡니다. Supabase Edge Function secrets에는 Supabase가 제공하는 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`와 직접 등록한 `TURNSTILE_SECRET_KEY`, `ALLOWED_ORIGINS`를 설정합니다. 자동 만료 정리를 사용할 때는 `COMMUNITY_PURGE_SECRET`도 추가합니다. `ALLOWED_ORIGINS`에는 로컬 주소와 GitHub Pages 등 실제 허용 origin만 쉼표로 구분해 넣습니다.
5. 비어 있는 신규 데이터베이스에는 아래 SQL 마이그레이션을 파일명 순서대로 적용합니다.

   - `migrations/202610190001_community_foundation.sql` — 커뮤니티 테이블, 기본 조회 API, RLS와 Storage 정책
   - `migrations/202610200001_profile_onboarding.sql` — 표시 이름 저장과 기존 계정 프로필 보완
   - `migrations/202610200002_hessxl_admin.sql` — X identity `hessxl_` 관리자 권한 확인
   - `migrations/202610210001_guestbook_live_author_names.sql` — 공개 방명록의 최신 프로필 이름 조회
   - `migrations/202610210002_hide_reported_community_content.sql` — 신고자가 신고한 글을 공개 목록에서 숨김
   - `migrations/202610210003_community_moderation_appeals_and_retention.sql` — 숨김 게시물·이의제기·7일 보존 처리
   - `migrations/202610210004_schedule_community_content_purge.sql` — 매시간 17분에 만료 콘텐츠 정리 작업 예약
   - `migrations/202610210005_community_appeal_rejection_results.sql` — 이의제기 기각 사유를 작성자에게 7일간 전달
   - `migrations/202610220001_hide_own_moderated_review_from_schedule.sql` — 숨김 처리된 본인 후기를 일반 일정 후기 목록에서도 제외

   `202610210004`를 적용하기 전에는 Edge Function Secrets의 `COMMUNITY_PURGE_SECRET`과 Database → Vault의 `community_purge_secret`에 동일한 무작위 비밀값을 등록합니다. 둘 중 하나라도 없으면 예약 작업은 실행되지 않습니다.

   기존 프로젝트는 일부 SQL을 Dashboard의 SQL Editor에서 직접 적용했으므로, CLI 이력이 실제 스키마와 다를 수 있습니다. Supabase CLI에 로그인한 뒤 연결된 프로젝트에 변경을 적용하기 전 `supabase migration list --linked`로 대조하고, 실제 테이블·함수·정책 적용 여부를 확인하세요. 이미 적용된 SQL을 다시 실행하거나 이력이 맞춰지기 전에 `supabase db push`를 하지 마세요. 기존 적용분은 DB 상태를 확인한 다음에만 migration history에 반영합니다.

6. `community-api` Edge Function을 최신 코드로 배포합니다. `supabase/config.toml`에서 `verify_jwt = false`인 것은 일부 비로그인 작업과 별도 비밀값 인증을 함께 받기 때문입니다. 사용자 작업은 함수 안에서 Supabase Auth의 `getUser(token)`으로 토큰을 직접 검증한 뒤 수행하며, 관리자 작업은 서버 측 관리자 권한을 추가로 확인합니다. 이 설정을 로그인 검증이 꺼졌다는 뜻으로 해석하지 않습니다.
7. 운영 메뉴는 X 로그인 계정 `hessxl_`에만 표시됩니다. 서버 측 관리자 확인은 X OAuth identity의 사용자명을 기준으로 하며, 화면 표시 이름을 바꾸는 것만으로 관리자 권한을 얻을 수 없습니다.
8. 로그인, 작성·수정·삭제, 신고, 관리자 숨김·삭제, 이의제기 승인·기각, 사진 한도, 중단 스위치를 익명·일반 사용자·관리자로 각각 시험합니다. 개인정보 안내에는 X 문의 계정 `@hessxl_`와 2027년 12월 31일 이후 서비스 데이터 폐기 예정일을 반영했습니다. 공개 전에 실제 처리 흐름과 정책이 일치하는지 최종 검토합니다.

## Edge Function 구조와 현재 점검

- `functions/community-api/index.ts`는 요청 인증, 제한·약관·관리자 권한 확인과 방명록·후기·신고·이의제기·계정 요청 분기를 조율합니다. `verify_jwt = false`여도 일반 사용자 요청은 함수 내부에서 `auth.getUser(token)`으로 검증됩니다.
- 현재 API는 하나의 POST 진입점에서 `action` 값으로 기능을 구분합니다. 방명록·후기는 `create-guestbook`·`edit-guestbook`·`create-review`·`edit-review`, 반응은 `toggle-like`, 미디어는 multipart `upload-image`와 `signed-media`·`delete-media`, 사용자 관리 기능은 `report-content`·`submit-appeal`·`delete-content`·`delete-account` 등으로 분기합니다. 관리자 전용 조회·운영은 `get-admin-*`·`update-admin-settings`·`moderate-report`·`resolve-appeal`이며, 예약 정리는 사용자 토큰 대신 `COMMUNITY_PURGE_SECRET`으로 인증합니다.
- `functions/community-api/http.ts`는 CORS 헤더, JSON 응답, Bearer 토큰 읽기와 문자열 입력 검증을 제공합니다. CORS는 브라우저 응답을 제한하는 설정이며 API 인증을 대신하지 않습니다. `http_test.ts`는 이 공통 도구의 동작을 Deno로 검사합니다.
- 검증 명령은 `deno test supabase/functions/community-api/http_test.ts supabase/functions/community-api/turnstile_test.ts`, `deno check supabase/functions/community-api/index.ts supabase/functions/community-api/turnstile_test.ts`, `deno lint --rules-exclude=no-import-prefix supabase/functions/community-api/http.ts supabase/functions/community-api/http_test.ts supabase/functions/community-api/index.ts supabase/functions/community-api/media.ts supabase/functions/community-api/moderation.ts supabase/functions/community-api/turnstile.ts supabase/functions/community-api/turnstile_test.ts`입니다. lint에서 import-prefix 규칙만 제외하는 것은 기존 Supabase 원격 모듈 import 형식 때문입니다.
- `deno check supabase/functions/community-api/index.ts`는 Edge Function의 정적 타입을 확인합니다. 루트 `deno.lock`은 Deno가 해석한 Supabase 원격 모듈 버전을 기록해 다음 검사에서 의존성 변경을 알아보기 쉽게 합니다.
- `functions/community-api/media.ts`는 비공개 Storage 업로드, 파일 검증, 사용량 예약·정산, 제한 시간 URL과 사진 삭제를 처리합니다.
- `functions/community-api/moderation.ts`는 숨김 콘텐츠, 이의제기 정보 연결, 만료 시 콘텐츠·파일 정리를 처리합니다.
- 2026-10-30 배포 후 `community-api` version 12가 ACTIVE이고 `verify_jwt = false`임을 CLI에서 확인했습니다. 배포 후 공개 방명록의 읽기 전용 RPC는 HTTP 200, 잘못된 JSON은 HTTP 400 `INVALID_REQUEST_BODY`, 인증 없는 쓰기는 HTTP 401 `UNAUTHORIZED`를 반환했습니다. 읽기 응답 본문은 기록하지 않았고, 잘못된 요청은 저장 데이터를 생성하지 않았습니다. Turnstile 외부 오류 분기는 위의 모의 응답 테스트로 검증했으며 운영 Cloudflare 장애를 일부러 재현하지 않았습니다. 로그인 세션을 이용한 잘못된 토큰의 원격 요청은 이번 smoke test에서 실행하지 않았습니다.
- SQL은 RLS로 직접 테이블 접근을 제한하고, 공개 조회와 일부 작업은 권한이 제한된 `SECURITY DEFINER` 함수로 제공합니다. `service_role` 키는 Edge Function 안에서만 사용해야 합니다.
- Turnstile 검증은 `turnstile.ts`에 분리되어 secret·토큰 누락, 유효 토큰, 무효 토큰, 잘못된 호스트, Cloudflare 비정상 응답, 연결 실패와 잘못된 JSON을 각각 검사합니다. Siteverify 호출에 테스트용 `fetcher`를 주입하므로 실제 Cloudflare를 중단하지 않고 실패 상황을 재현할 수 있습니다. 보호 대상 쓰기는 검증에 실패하면 통과하지 않습니다.
- `respondError`는 예상 가능한 입력·인증·권한·미존재·충돌·요청 제한·외부 서비스 오류를 각 HTTP 상태와 안정적인 `{ code, error }` 응답으로 변환합니다. 처리되지 않은 예외는 세부 내용을 로그에만 남기고 일반화된 HTTP 500으로 응답합니다. 프런트엔드가 오류 코드와 한국어 안내 문구를 계속 읽을 수 있습니다.
- 첫 코드 정리로 공통 HTTP 도구를 `http.ts`에 분리하고 응답·CORS·입력 검증 테스트 4개를 추가했다. 이 변경은 DB 스키마를 수정하지 않으며, 2026-10-22에 `community-api` version 9로 배포했다. CLI 원격 마이그레이션 목록에는 `202610220001`만 기록되고 이전 8개 로컬 마이그레이션은 원격 기록에서 확인되지 않았다. 원격 DB 구조와 SQL Editor 실행 이력을 대조하기 전까지 이 차이를 `db push`나 migration repair로 정리하지 않는다. 후속 작업은 액션별 인증·권한·DB 변경 경계를 검사하고 요청 분기를 책임별 핸들러로 나누는 것이다. 자체 백엔드 이전은 아직 시작하지 않는다.

## 한도와 운영

- 사진은 JPG/PNG/WebP만 받습니다. 브라우저는 1MB가 넘는 이미지를 긴 변 2,000px 이내 WebP로 줄이고, Edge Function은 실제 MIME과 파일 헤더, 실제 바이트 수를 다시 확인합니다.
- 방명록은 계정당 시간당 3회, 후기는 시간당 5회, 사진 업로드는 시간당 6회로 제한합니다. 신고와 좋아요에도 별도 계정별 제한이 적용됩니다. 개인정보 안내 문구가 바뀌면 Edge Function의 동의 버전도 함께 올려 새 동의를 받습니다.
- 파일 하나는 1MB, 게시물 하나는 3장, 계정 하나는 총 10장·10MB입니다. 전체 사용자 사진 사용량은 700MB부터 주의하고 800MB에서 업로드를 거부합니다. DB 예약 행을 먼저 확보해 동시 업로드도 한도에 포함합니다.
- DB가 400MB에 도달하면 서버가 사용자 콘텐츠 쓰기를 중단합니다. 관리자는 `/admin/settings`에서 커뮤니티 쓰기, 업로드, 사진 열람을 따로 중단할 수 있습니다. DB 경고 기준 350MB와 월 egress 경고 3.5GB·중단 4GB는 Supabase 대시보드의 실제 사용량을 확인해 대응합니다.
- Supabase Free만으로 대규모 DDoS 가용성을 보장하지 않습니다. Auth와 계정별 요청 제한, Turnstile, 사용량 감시와 중단 스위치를 함께 사용합니다. 지도·일정은 정적 자산이므로 커뮤니티 기능 장애 때도 계속 조회할 수 있습니다.
- 사진은 private Storage에 저장하며, 공개 게시물에서 보여줄 때 5분짜리 signed URL을 발급합니다. 사진 열람 스위치를 끄면 새 URL을 발급하지 않습니다. 이미 발급한 URL은 만료 시각까지 유효할 수 있습니다.
- 계정 삭제 시 본문과 후기는 “익명 사용자”로 남기고 작성 계정 연결, 좋아요, 첨부 사진은 삭제합니다.
- 관리자가 글을 숨길 때 사유, 숨김 시각, 삭제 예정 시각을 저장합니다. 작성자는 `/account/posts`에서 자기 글과 운영 사유를 확인하고 7일 안에 이의제기할 수 있습니다. 대기 중인 이의제기는 만료 작업을 멈추며, 승인하면 게시물이 즉시 자동 재공개됩니다. 기각하면 게시글·사진·신고 인용문·이의제기 원문을 즉시 삭제하고, 게시물 내용이 없는 기각 사유 안내만 작성자에게 7일간 제공한 뒤 자동 삭제합니다.
- 이의제기 없이 숨김 상태로 7일이 지나면 Edge Function이 private Storage 원본 사진, DB 게시물, 신고 인용문과 이의제기 기록을 함께 제거합니다. 이 작업은 되돌릴 수 없고, 제거가 끝나면 관리자 화면에도 남지 않습니다. Edge Function 배포와 두 비밀값 등록이 끝나기 전에는 자동 만료 정리가 활성화되지 않습니다.

> 무료 등급의 정확한 제한은 서비스 운영 시점과 조직의 다른 프로젝트 사용량에 따라 달라질 수 있으므로 공개 전 Supabase Dashboard의 Billing/Usage를 다시 확인하세요. 사용자 지정 도메인과 외부 보호 서비스를 추가하기 전까지 `github.io`와 Supabase API를 Cloudflare가 자동 보호한다고 가정하지 않습니다.

## 최종 배포 후 임시 설정 정리

- 실제 공개 도메인과 운영 방식이 확정되면 Cloudflare Turnstile 위젯에서 `localhost`, `127.0.0.1`, `h1key-activity-archive-test.decentkid32.chatgpt.site`를 허용 호스트 목록에서 제거합니다. GitHub Pages를 계속 운영 도메인으로 쓸 때는 `mangang0713.github.io`를 유지하고, 자체 도메인으로 바꾸면 새 도메인을 먼저 추가·검증한 뒤 GitHub Pages 호스트를 제거합니다.
- Supabase Edge Function의 `ALLOWED_ORIGINS`에서도 로컬·임시 테스트 origin을 제거하고, 실제 운영 origin만 남깁니다.
- 테스트용 Cloudflare 위젯이나 더 이상 쓰지 않는 키가 따로 생긴 경우 운영 위젯 사용 여부를 확인한 뒤 삭제합니다. 현재 사용 중인 위젯을 정리 목적으로 성급히 삭제하지 않습니다.
