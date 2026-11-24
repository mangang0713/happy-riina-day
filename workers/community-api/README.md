# Cloudflare Worker 백엔드 파일럿

이 폴더는 Supabase 운영본과 분리된 학습·이관 파일럿입니다. 현재 사이트는 계속 Supabase를 사용하며, 여기의 API·스키마는 운영 사이트에 연결되어 있지 않습니다.

## 로컬 실행

1. Docker Desktop 또는 Rancher Desktop을 실행합니다.
2. 저장소 루트에서 `npm run worker:db:up`을 실행합니다. PostgreSQL은 `127.0.0.1:5433`에서만 열리고, 처음 시작할 때 `migrations/`의 SQL이 새 로컬 볼륨에 적용됩니다.
3. 이 폴더의 `.dev.vars.example`을 `.dev.vars`로 복사합니다. OAuth를 실제 시험할 때만 각 provider 자격 증명을 로컬 파일에 넣습니다.
4. 저장소 루트에서 `npm run worker:dev`를 실행합니다. 프런트엔드 정적 파일은 `/`, API는 `/api/*`, 로컬 주소는 `http://localhost:8787`입니다.

Docker 데이터는 `community-postgres-data` 로컬 볼륨에 남습니다. `npm run worker:db:down`은 컨테이너만 중지하고 볼륨을 지우지 않습니다.

## 현재 구현

- `GET /health`: Worker 실행 확인
- `GET /api/v1/providers`: 자격 증명이 모두 준비된 소셜 로그인 provider만 반환
- `/api/auth/*`: Better Auth OAuth·세션 경로
- `GET /api/v1/me`: 인증 세션에서 사용자 ID만 반환
- `GET /api/v1/me/profile`: 현재 사용자의 공개 표시 이름과 기록된 동의 버전을 반환
- `PATCH /api/v1/me/profile`: 표시 이름을 1~40자로 검증하고 시간당 10회로 제한해 저장
- `POST /api/v1/me/community-terms`: 서버에서 현재 `2026-10-21-v2` 버전과 동의 시각을 기록
- `GET /api/v1/admin/settings`: 관리자 전용 기능 중단 스위치와 DB·사진 저장량 조회
- `PATCH /api/v1/admin/settings`: 관리자 전용 방명록 작성·사진 업로드·사진 보기 스위치 변경
- `GET /api/v1/schedules/:scheduleId/reactions`: 공개 좋아요 수와 로그인 사용자의 좋아요 여부·공개 후기 ID를 반환
- `GET /api/v1/schedules/:scheduleId/reviews/own`: 로그인한 작성자의 공개 후기와 Worker 미디어 경로를 반환. 숨김 후기는 일정 화면에 노출하지 않음
- `GET /api/v1/guestbook` 및 일정 후기 조회: 공개 글을 기존 화면과 같은 배열·미디어 필드로 반환. `signed_url`은 매 요청마다 권한을 확인하는 Worker 사진 경로이며 Supabase 서명 URL과는 다름
- `src/features/community/workerApi.ts`, `workerCommunityWrites.ts`, `workerModerationWrites.ts`: same-origin cookie와 Worker 오류 형식을 처리하는 typed client. 공개 방명록·후기, 프로필·반응·내 게시글·관리자 조회와 글·후기 저장, 사진 업로드·삭제, 좋아요·약관 동의, 신고·이의제기·관리자 숨김·복원을 지원합니다. `worker:dev`의 Worker 모드 화면에서 사용하며 GitHub Pages 기본 빌드는 기존 Supabase client를 계속 사용합니다.
- `POST /api/v1/guestbook`: 로그인, 최신 공개 안내 동의, Turnstile, 시간당 10회 작성 제한을 확인한 뒤 방명록 작성
- `PUT /api/v1/guestbook/:postId`: 같은 검증과 시간당 8회 수정 제한을 적용하고, 작성자 본인의 공개 글만 수정
- `POST /api/v1/schedules/:scheduleId/reviews` 및 `PUT` 수정 경로: 별점 1~5점, 일정당 사용자 후기 1개, 시간당 저장 5회와 작성자 권한 검사
- `POST /api/v1/schedules/:scheduleId/like`: 시간당 30회 제한 아래 좋아요 상태를 트랜잭션 잠금으로 안전하게 전환
- `DELETE /api/v1/content/:contentType/:contentId`: 작성자가 공개 상태 본인 글·후기를 삭제합니다. 숨김 검토 중인 콘텐츠는 보존하며 연결 사진·진행 중 업로드·저장량 예약도 정리합니다. 시간당 10회 제한을 적용합니다.
- `POST /api/v1/media`: 공개 방명록·후기에 JPG/PNG/WebP를 첨부합니다. MIME 선언과 파일 시그니처를 대조하고, 계정별 10장·10MiB, 게시물별 3장, 파일별 1MiB, 전체 저장소 설정 한도를 DB 예약으로 먼저 확보한 다음 private R2 binding에 저장합니다.
- `DELETE /api/v1/media/:mediaId`: 작성자 또는 관리자가 공개 게시물의 사진을 삭제합니다. 숨김 검토 중인 콘텐츠는 보존 기간 동안 첨부 파일을 삭제할 수 없습니다.
- `GET /api/v1/media/:mediaId`: 공개 상태와 신고자별 숨김 상태를 확인한 뒤 비공개 R2 객체를 전달. 숨김 콘텐츠의 작성자와 관리자만 검토 중인 첨부 파일을 볼 수 있습니다.
- `/api/v1/reports`, `/api/v1/admin/reports`, `/api/v1/admin/hidden-content`: 신고 제출·관리자 검토·숨김 목록 조회. 신고자는 본인에게 신고 대상 글을 숨길 수 있고, 본인 글 신고 및 중복 신고는 거절합니다.
- `/api/v1/admin/content/:type/:id/hide|restore`: 관리자가 사유와 함께 글을 숨기고 복원합니다. 숨김 후 7일을 보존 기간으로 둡니다.
- `/api/v1/content/:type/:id/appeals`, `/api/v1/admin/appeals/:appealId/decision`, `/api/v1/me/content`: 작성자 이의제기, 관리자 승인·기각, 내 게시글과 이의제기 결과 조회. 승인하면 자동 복원하고, 기각하면 글과 사진을 삭제한 뒤 기각 사유만 7일 동안 보존합니다.
- 15분 간격 Cron은 7일 보존 기한이 지난 숨김 글과 만료된 이의제기 결과 안내를 제한된 배치로 정리합니다. 대기 중인 이의제기가 있는 글은 purge하지 않습니다.
- `POST /api/auth/delete-user`: Better Auth의 최근 로그인 확인(기본 24시간 이내)을 거쳐 계정을 삭제합니다. 삭제 전 방명록·후기는 `익명 사용자`로 보존하고, 좋아요·작성자 이의제기·계정 소유 사진·진행 중 사진 예약을 지우며 저장량을 정산합니다. Better Auth가 소셜 계정·세션·프로필·관리자 권한을 제거하고, 신고 기록은 신고자 계정 연결을 끊어 보존합니다.
- `migrations/0001_better_auth.sql`~`0003_media_upload_reservations.sql`: 로컬 파일럿용 PostgreSQL 스키마 및 업로드 예약 필드

신고·관리·이의제기·7일 만료 정리·계정 삭제까지 로컬 Worker 파일럿에 구현되어 있습니다. Worker 모드에서 Google OAuth 로그인을 확인했고, 사용자가 X·Kakao 로컬 로그인을 완료했다고 확인했습니다. 방명록·후기 쓰기 요청은 서버의 Turnstile Siteverify를 통과해야 저장됩니다. Neon Hyperdrive·Cloudflare R2 연결과 기존 사용자·콘텐츠 이전은 하지 않았습니다. GitHub Pages 공개 화면과 Supabase 운영 데이터는 변경하지 않았습니다.

업로드는 먼저 PostgreSQL 트랜잭션으로 계정·전체 사용량을 잠그고 10분간 용량을 예약합니다. 파일 저장 또는 DB 확정에 실패하면 R2 객체와 예약을 정리하고, 다음 업로드 요청 시 만료된 예약도 제한된 개수씩 청소합니다. R2 파일은 공개 URL로 노출하지 않으며 Worker가 게시물 공개 상태와 신고자별 숨김 여부를 확인한 뒤 전달합니다.

### 글쓰기 검증과 오류 응답

- 글 작성·수정은 `.dev.vars` 또는 Worker secret의 `TURNSTILE_SECRET_KEY`를 사용해 Cloudflare Siteverify를 호출합니다. secret이 없거나 Cloudflare에 연결할 수 없으면 `503 BOT_CHECK_UNAVAILABLE`, 토큰이 없거나 유효하지 않으면 `403 BOT_CHECK_FAILED`로 거절합니다. 보호를 우회하는 fail-open 처리는 없습니다.
- 정상적인 글쓰기에는 로그인 세션, `2026-10-21-v2` 공개 안내 동의, `community_settings.community_enabled`, DB 크기 400 MiB 미만이 필요합니다. 방명록은 2~1,200자이며, 계정별 작성은 시간당 10회, 수정은 시간당 8회로 제한합니다.
- 안정적인 오류 계약은 `{ "code": string, "error": string }`입니다. 대표 상태는 로그인 필요 `401 UNAUTHORIZED`, 입력 오류 `400 INVALID_INPUT`, 동의 누락 `403 COMMUNITY_TERMS_REQUIRED`, 작성자/공개 상태가 아닌 글 `403 CONTENT_NOT_EDITABLE`, 일정 중복 후기 `409 REVIEW_ALREADY_EXISTS`, 제한 초과 `429 RATE_LIMITED`, 설정·DB·검증 서비스 장애 `503`, 예상하지 못한 내부 오류 `500 INTERNAL_ERROR`입니다.
- Turnstile 테스트는 Siteverify 호출부에 가짜 응답을 주입해 수행합니다. 테스트는 외부 Cloudflare 상태나 실제 key에 의존하지 않습니다. 운영의 Cloudflare 설정을 바꾸거나 실제 장애를 만들지 않습니다.

## 로그인 권한 설계

- X는 프로필 조회에 사용하는 `users.read`와 X OAuth 현재 사용자 프로필 API가 요구하는 `tweet.read`를 요청합니다. `tweet.read`는 동의 화면에서 게시물 읽기 범위로 안내될 수 있지만, 이 앱은 `/2/users/me`만 호출하고 게시물 API를 요청하거나 게시물을 수집하지 않습니다. 이메일과 `offline.access`는 요청하지 않습니다.
- Kakao는 닉네임·프로필 이미지 동의 항목만 요청합니다. 이메일을 받지 않으며, 안정적인 Kakao 사용자 ID에서 `.invalid` 형식의 내부 식별용 이메일을 만듭니다.
- 이메일이나 표시 이름을 기준으로 계정을 자동 병합하지 않습니다. 기존 계정 연결은 인증된 사용자가 명시적으로 수행하도록 설정했습니다.
- OAuth 토큰은 Better Auth 계정 테이블에 암호화해 저장하도록 설정했습니다. 실제 Worker 비밀값은 `.dev.vars` 또는 Cloudflare Secret에만 둡니다.

## 운영 연결 전 확인

- Workers `Hyperdrive`를 Neon에 연결하고, R2 버킷을 실제로 생성한 뒤 Wrangler binding을 지정해야 합니다.
- Google/X/Kakao OAuth callback에 새 Worker 주소를 등록해야 합니다.
- 각 provider scope, 계정 연결, Better Auth 스키마를 staging에서 검증해야 합니다.
- 기존 Supabase Auth 사용자 ID와 provider 계정 ID를 안전하게 대조하고 콘텐츠·사진·삭제 보존 상태를 반복 이관해야 합니다.
- 모든 사용자 기능과 롤백을 검증하기 전에는 GitHub Pages 주소 변경, 데이터 쓰기 원본 전환, Supabase 삭제를 하지 않습니다.

## 현재 로컬 검증 기록

- `npm run worker:typecheck`, `npm run worker:test` (기본 테스트와 moderation 통합 테스트; `WORKER_TEST_DATABASE_URL` 설정 시 Docker PostgreSQL에서 실제 로컬 DB 통합 검증), `npm run lint`, `npm run format:check`, `npm run build`, `npm run worker:build`를 통과했습니다.
- Wrangler 로컬 실행에서 `/health`, `/api/health`, `/api/v1/providers`가 200, 알 수 없는 `/api/*`가 JSON 404를 반환했고 `/`, `/archive`, `/guestbook`, 일정 상세 경로가 정적 SPA 페이지로 제공되는 것을 확인했습니다.
- Docker 로컬 PostgreSQL에 세 마이그레이션을 적용해 Better Auth 4개와 커뮤니티 테이블 생성을 확인했습니다.
- DB 연결 방식을 요청 단위로 바꾼 뒤 공개 방명록·후기 조회 200, 없는 미디어 404, 비로그인 세션 401을 각각 세 차례 반복 확인했습니다.
- 방명록·후기 작성/수정과 좋아요 전환은 주입형 테스트와 격리된 로컬 PostgreSQL 통합 테스트로 저장·수정·중복 방지·소유권·사용량 제한을 확인했습니다. 사진 업로드·전달·삭제는 로컬 PostgreSQL과 메모리 R2 대체물로 파일 형식, 비공개 접근, 권한, 사용량 정산을 확인했습니다. 신고·숨김·복원·이의제기와 계정 삭제는 합성 QA 계정 통합 테스트로 권한, 자동 복원, 기각 후 삭제·사유 보존, 만료 purge, 글 익명화, 좋아요·사진·예약·소셜 계정·세션·관리자 권한 정리를 확인했습니다. 실제 Cloudflare Siteverify와 실제 R2 binding은 아직 미검증입니다.
- Better Auth 메모리 어댑터와 가짜 client 설정으로 Google/X/Kakao 승인 URL, 동일 출처 callback URL과 X의 `users.read`·`tweet.read` scope 생성을 검사합니다. provider 네트워크 응답과 OAuth callback 검증은 별도 브라우저 QA와 구분합니다.
- 관리자 설정 경로는 실제 로컬 PostgreSQL에 연결된 상태에서 HTTP 조회와 쓰기 통합 테스트를 통과했습니다. 로컬 smoke test에서 설정 조회는 200, 비로그인 프로필·관리자 경로는 401을 반환했습니다.
- 프런트엔드 Supabase RPC/action과 Worker REST API의 계약을 대조했습니다. 공개 방명록·후기 목록은 기존 화면이 읽는 배열과 `media[].signed_url` 모양에 맞췄습니다. Worker URL은 매 요청마다 게시물 권한을 확인하는 경로이므로 Supabase 서명 URL과 구현 방식은 다릅니다. 화면은 Worker 모드에서 Worker API client로 연결되고, GitHub Pages 기본 빌드에서는 Supabase client를 사용합니다.
- Neon Hyperdrive와 실제 Cloudflare R2 연결은 미검증입니다.
- GitHub Pages 공개 서비스와 기존 사용자 데이터는 계속 Supabase를 사용합니다. 로컬 Worker 모드에만 화면을 연결했으며 Worker를 원격 배포하거나 기존 계정·콘텐츠를 이전하지 않았습니다. 당시에는 OAuth provider callback과 Cloudflare Siteverify, Neon Hyperdrive, R2 연결을 검증하지 않았습니다.

### 2026-11-02 로컬 PostgreSQL 통합 검증

- WSL 업데이트 후 Rancher Desktop의 Docker 엔진을 복구했습니다. 기존 로컬 PostgreSQL 볼륨은 보존했고 컨테이너가 healthy 상태인 것을 확인했습니다.
- 세 개의 로컬 SQL 마이그레이션을 적용한 뒤 `WORKER_TEST_DATABASE_URL`을 테스트 프로세스에만 전달해 Worker DB 통합 테스트를 실행했습니다. 36개 테스트가 모두 통과했고, 테스트 전후에 사용자·관리자·프로필·방명록·후기·미디어·업로드 예약·요청 제한 데이터가 비어 있어 테스트 자료가 정리된 것을 확인했습니다.
- `npm run build`, `npm run lint`, `npm run worker:typecheck`, `npm run format:check`, `git diff --check`가 통과했습니다. 로컬 Worker smoke test에서 `/health`, `/api/health`, `/api/v1/providers`, `/api/v1/settings`, 공개 글 목록과 주요 SPA 경로는 HTTP 200, 비로그인 `/api/v1/me`, 프로필·관리자 경로는 HTTP 401을 반환했습니다.
- 로컬 OAuth provider 키와 `TURNSTILE_SECRET_KEY`가 비어 있어 X·Google·Kakao의 실제 로그인 callback과 실제 Cloudflare Siteverify 글쓰기는 확인하지 않았습니다. 인증·봇 검증 우회는 추가하지 않았습니다. 실제 R2 대신 테스트 대체물을 사용했으며 Neon, 원격 배포, Supabase 데이터 이전은 하지 않았습니다.
- PostgreSQL 컨테이너와 데이터 볼륨은 검증 후에도 유지되어 있습니다. 로컬 사용을 마친 뒤 `npm run worker:db:down`으로 컨테이너를 종료할 수 있으며, 이 명령은 볼륨을 삭제하지 않습니다.

### 2026-11-24 Worker 경로 라우팅 확인

- Cloudflare Static Assets가 `/api/*`와 `/health` 요청을 SPA 정적 파일로 먼저 처리하지 않도록 `wrangler.toml`의 `assets.run_worker_first`에 두 경로 패턴을 지정했습니다. 이 설정은 정적 화면은 Assets에서 제공하면서 API 요청은 Worker 핸들러에 전달합니다.
- `npm run worker:test`에서 33개 테스트가 통과했고, Docker 엔진이 꺼져 있어 실제 PostgreSQL 연결을 요구하는 3개 테스트는 건너뛰었습니다. 이는 2026-11-02에 수행한 전체 PostgreSQL 통합 검증 결과를 대체하지 않습니다.
- Rancher Desktop을 업데이트·재시작해 로컬 PostgreSQL 컨테이너가 healthy 상태인 것을 확인한 뒤 테스트를 재실행했습니다. 이번에는 DB 통합 테스트를 포함한 36개가 모두 통과했습니다. 통합 테스트별 정리 훅도 오류 없이 완료됐습니다.
- `npm run worker:build`의 타입 검사와 Wrangler 배포 dry-run이 통과했습니다. 임시 로컬 Worker smoke test에서 `/health`, `/api/health`, `/api/v1/providers`, `/archive`, 일정 상세 경로는 HTTP 200을 반환했습니다. `/api/v1/settings`는 라우팅되어 Worker에 도달했지만 DB가 실행 중이지 않아 `503 DATABASE_UNAVAILABLE`을 반환했습니다.
- Docker와 PostgreSQL을 다시 시작한 뒤 동일한 smoke test를 실행했습니다. `/health`, `/api/health`, `/api/v1/providers`, `/api/v1/settings`가 모두 HTTP 200을 반환했고, 공개 설정에는 커뮤니티 작성·업로드·사진 보기 토글만 포함됨을 확인했습니다. 로컬 Worker 프로세스는 확인 후 종료했습니다.
- 별도 로컬 브라우저 QA에서는 Google OAuth 로그인 복귀와 로그인 세션, 방명록·후기 작성 흐름을 확인했습니다. 사용자는 X·Kakao 로그인이 완료됐다고 확인했습니다. Turnstile 위젯은 `appearance: 'interaction-only'`로 렌더링되어 보통은 화면에 나타나지 않고, Cloudflare가 방문자 상호작용을 요구할 때 나타납니다. Worker는 토큰 누락·무효 시 쓰기를 거절하고 서버에서 Siteverify와 hostname을 확인합니다. 따라서 Worker 모드에서 QA 글·후기가 실제 저장된 것은 유효 토큰이 통과했다는 근거로 판단합니다. 무효 토큰의 실제 브라우저 재현은 별도 확인하지 않았고, 실패 응답은 모의 응답 테스트로 검증했습니다.
- GitHub Pages와 Supabase 운영 서비스에는 배포하지 않았고, DB 마이그레이션·운영 사용자 데이터 변경도 없습니다. 기존 Worker PostgreSQL 볼륨과 컨테이너는 로컬에서 healthy 상태로 유지되어 있습니다.

### 2026-11-24 Google 계정 QA와 X OAuth 프로필 처리

- Google 기존 테스트 계정으로 로컬 Worker에 로그인해 이의제기 승인 후 자동 복원, 기각 후 게시물 영구 삭제 및 작성자에게 7일간 기각 사유 표시를 확인했습니다. 두 결과가 내 게시글의 이의제기 결과 분류에 표시됩니다.
- 일정 후기 `[QA] 일정 후기 작성·수정 흐름을 확인하기 위한 테스트입니다.`가 2026-05-02 일정 상세와 내 게시글에 표시되는 것을 확인했습니다. 좋아요는 켰다가 다시 꺼 최종 0건입니다.
- 후기 편집 화면에서 약관 동의가 유지되는 것을 확인했습니다. 사진 선택과 후기 수정 제출은 Turnstile이 재확인을 요구해 멈췄으며, CAPTCHA는 자동으로 풀지 않았습니다. 사진 미리보기·업로드·삭제 QA는 미완료입니다. 현재 계정의 QA 자료는 로컬 DB에만 있으며 공개 Supabase 데이터는 변경하지 않았습니다.
- X의 `/2/users/me` 요청에 사용할 프로필 매핑을 `getXUserInfo`로 분리했습니다. 응답 오류 시 토큰·본문을 로그에 남기지 않고 상태 코드와 필드 유무만 진단하도록 했습니다. X OAuth scope에는 `users.read`와 `tweet.read`가 포함됩니다. 후자는 X 동의 화면에 게시물 읽기 권한으로 표시될 수 있으나, 앱은 게시물 API를 호출하지 않고 프로필 조회만 수행합니다. 이메일과 `offline.access`는 요청하지 않습니다.
- 검증: `npm run worker:test` 36개 통과·DB 환경변수 미설정으로 3개 DB 통합 테스트 건너뜀, `npm run worker:typecheck`, `npm run build`, `npm run lint`, `npm run format:check`, `git diff --check` 통과. 앞선 별도 PostgreSQL 통합 검증에서 36개 전체 통과한 기록은 유지합니다.
- 기능별 커밋: [X 프로필 조회 권한 오류 처리 보강 — f7e36d9](https://github.com/mangang0713/happy-riina-day/commit/f7e36d9), [Worker 관리자 자동 등록 요청 건너뛰기 — 7137437](https://github.com/mangang0713/happy-riina-day/commit/7137437), [커뮤니티 확인 대화상자 중앙 정렬 — 14eb89c](https://github.com/mangang0713/happy-riina-day/commit/14eb89c). 세 커밋은 `codex/backend-workers-migration`에 푸시했으며, `main`, GitHub Pages, Worker 운영 배포, 운영 Supabase는 변경하지 않았습니다.
- 후속 QA: Turnstile을 사용자가 직접 재확인한 뒤 후기 수정과 합성 사진 미리보기·업로드·삭제를 진행합니다. 영구 삭제가 필요한 QA 게시물은 매번 정확한 대상을 확인받은 뒤 처리합니다.

관리자 설정 경로는 `admin_members`에 등록된 계정만 사용할 수 있습니다. 관리자 등록·해제 API는 권한 상승을 막기 위해 제공하지 않으며 파일럿 DB에서 별도 통제 절차로 관리해야 합니다. 전송량 경고·중단 수치는 운영 기준값이며 Worker가 계정 전체의 실제 전송량을 측정한다는 의미는 아닙니다.
