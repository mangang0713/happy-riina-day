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
- `src/features/community/workerApi.ts`: same-origin cookie와 Worker 오류 형식을 처리하는 typed 공개 목록 client. 현재 React 화면에서는 아직 호출하지 않음
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

신고·관리·이의제기·7일 만료 정리·계정 삭제까지 로컬 Worker 파일럿에 구현되어 있습니다. 다만 Cloudflare R2 실제 버킷 연결, 브라우저 프런트엔드 연결, 기존 사용자·콘텐츠 이전은 아직 하지 않았습니다. 기존 페이지와 운영 사용자 데이터는 변경되지 않았습니다.

업로드는 먼저 PostgreSQL 트랜잭션으로 계정·전체 사용량을 잠그고 10분간 용량을 예약합니다. 파일 저장 또는 DB 확정에 실패하면 R2 객체와 예약을 정리하고, 다음 업로드 요청 시 만료된 예약도 제한된 개수씩 청소합니다. R2 파일은 공개 URL로 노출하지 않으며 Worker가 게시물 공개 상태와 신고자별 숨김 여부를 확인한 뒤 전달합니다.

### 글쓰기 검증과 오류 응답

- 글 작성·수정은 `.dev.vars` 또는 Worker secret의 `TURNSTILE_SECRET_KEY`를 사용해 Cloudflare Siteverify를 호출합니다. secret이 없거나 Cloudflare에 연결할 수 없으면 `503 BOT_CHECK_UNAVAILABLE`, 토큰이 없거나 유효하지 않으면 `403 BOT_CHECK_FAILED`로 거절합니다. 보호를 우회하는 fail-open 처리는 없습니다.
- 정상적인 글쓰기에는 로그인 세션, `2026-10-21-v2` 공개 안내 동의, `community_settings.community_enabled`, DB 크기 400 MiB 미만이 필요합니다. 방명록은 2~1,200자이며, 계정별 작성은 시간당 10회, 수정은 시간당 8회로 제한합니다.
- 안정적인 오류 계약은 `{ "code": string, "error": string }`입니다. 대표 상태는 로그인 필요 `401 UNAUTHORIZED`, 입력 오류 `400 INVALID_INPUT`, 동의 누락 `403 COMMUNITY_TERMS_REQUIRED`, 작성자/공개 상태가 아닌 글 `403 CONTENT_NOT_EDITABLE`, 일정 중복 후기 `409 REVIEW_ALREADY_EXISTS`, 제한 초과 `429 RATE_LIMITED`, 설정·DB·검증 서비스 장애 `503`, 예상하지 못한 내부 오류 `500 INTERNAL_ERROR`입니다.
- Turnstile 테스트는 Siteverify 호출부에 가짜 응답을 주입해 수행합니다. 테스트는 외부 Cloudflare 상태나 실제 key에 의존하지 않습니다. 운영의 Cloudflare 설정을 바꾸거나 실제 장애를 만들지 않습니다.

## 로그인 권한 설계

- X는 `users.read`만 요청합니다. 게시물·이메일·오프라인 접근 범위는 요청하지 않습니다. 사용자 프로필은 `/2/users/me` 한 번만 조회하도록 별도 매핑했습니다.
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
- Better Auth 메모리 어댑터와 가짜 client 설정으로 Google/X/Kakao 승인 URL, 동일 출처 callback URL과 X의 `users.read` 전용 scope 생성 테스트를 통과했습니다. provider로 실제 네트워크 요청을 하거나 로그인 callback을 처리하지는 않았습니다. OAuth client 자격 증명이 로컬에 설정되지 않아 실제 로그인을 검증하지 않았습니다.
- 관리자 설정 경로는 이번 변경에서 추가했으며 Worker 타입 검사·린트·프런트엔드 빌드만 확인했습니다. 실제 HTTP 요청과 DB 쓰기 동작은 로컬에서 별도 검증하지 않았습니다.
- 프런트엔드 Supabase RPC/action과 Worker REST API의 계약을 대조했습니다. 공개 방명록·후기 목록은 기존 화면이 읽는 배열과 `media[].signed_url` 모양에 맞췄습니다. Worker URL은 매 요청마다 게시물 권한을 확인하는 경로이므로 Supabase 서명 URL과 구현 방식은 다릅니다. 쓰기 경로, 액션 이름, 사진 업로드 방식은 여전히 다르며 브라우저 API client 전환은 미완료입니다.
- Neon Hyperdrive와 실제 Cloudflare R2 연결은 미검증입니다.
- 기존 프런트엔드와 공개 서비스는 여전히 Supabase를 사용합니다. Worker의 커뮤니티 기능과 Better Auth 계정 삭제는 로컬 파일럿에만 있고 브라우저와 연결하거나 실제 배포하지 않았습니다. OAuth callback, 실제 R2와 계정·콘텐츠 이전도 미완료입니다.

관리자 설정 경로는 `admin_members`에 등록된 계정만 사용할 수 있습니다. 관리자 등록·해제 API는 권한 상승을 막기 위해 제공하지 않으며 파일럿 DB에서 별도 통제 절차로 관리해야 합니다. 전송량 경고·중단 수치는 운영 기준값이며 Worker가 계정 전체의 실제 전송량을 측정한다는 의미는 아닙니다.
