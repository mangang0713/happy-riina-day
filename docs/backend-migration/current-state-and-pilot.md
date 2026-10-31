# Supabase에서 자체 백엔드로의 단계별 이관

작성일: 2026-10-31
상태: 로컬 파일럿 기반 준비 중. 운영 트래픽은 아직 Supabase에 있습니다.

## 현재 서비스의 실제 경계

- 지도·행사·세트리스트는 TypeScript 정적 데이터입니다. 커뮤니티 백엔드를 옮겨도 지도 읽기는 Supabase와 분리되어 계속 제공할 수 있습니다.
- 소셜 로그인과 세션은 Supabase Auth가 관리하며 X, Google, Kakao provider를 사용합니다.
- 사용자 콘텐츠의 읽기·쓰기는 PostgreSQL RPC/RLS와 `community-api` Edge Function에서 나뉘어 처리됩니다. 브라우저는 일부 공개 읽기 RPC와 프로필 조회를 직접 부릅니다.
- 사진은 private Supabase Storage 버킷에 보관하고 Edge Function이 업로드 한도, 게시물 연결, 서명 URL과 삭제를 조율합니다.
- Edge Function 책임은 프로필·약관, 방명록·후기, 좋아요, 이미지, 신고, 관리자 설정, 숨김·이의제기·복원·만료 삭제, 계정 삭제까지 이어집니다.

## 기존 데이터와 권한 기준

현재 공개 스키마의 커뮤니티 테이블 14개:

1. `profiles`
2. `admin_members`
3. `community_settings`
4. `user_media_usage`
5. `guestbook_posts`
6. `schedule_likes`
7. `schedule_reviews`
8. `community_media`
9. `content_reports`
10. `media_quota_reservations`
11. `community_rate_limits`
12. `community_public_rate_limits`
13. `content_appeals`
14. `content_appeal_results`

기존 DB는 공개 읽기를 RLS·RPC로 제한하고, 쓰기와 관리자 변경은 Edge Function 및 `SECURITY DEFINER` RPC가 처리합니다. Storage는 공개 버킷이 아니며 앱이 제한된 접근 URL을 제공합니다. 계정당 10장·총 10MB, 글당 최대 3장·파일당 최대 1MB, 전체 저장소 800MB 상한과 예약·정리 로직이 있습니다. 숨겨진 게시물은 이의제기 기간 동안 7일간 보존되고, 승인하면 자동 공개, 기각하면 게시물·사진을 지우고 사유만 작성자에게 7일간 남깁니다.

## 기존 Edge Function 책임 목록

`supabase/functions/community-api/index.ts`는 아래 요청을 조율합니다.

- 공개 읽기·파일: `signed-media`, `get-admin-settings`, `get-admin-reports`, `get-admin-hidden-content`, `get-my-content`
- 동의·프로필·계정: `accept-community-terms`, `update-profile`, `delete-account`
- 게시물·반응: `create-guestbook`, `edit-guestbook`, `create-review`, `edit-review`, `toggle-like`, `delete-content`
- 사진: `upload-image`, `delete-media`
- 신고·관리: `report-content`, `moderate-report`, `hide-content`, `restore-hidden-content`, `update-admin-settings`
- 이의제기·보존: `submit-appeal`, `resolve-appeal`, `purge-expired-content`

미디어 할당량과 파일 작업은 `media.ts`, 숨김·이의제기·만료 정리는 `moderation.ts`로 분리되어 있습니다. RPC에는 공개 방명록·후기 조회, 반응 통계, 관리자 확인, 업로드 할당량 예약/확정/해제, 요청 제한, appeal 처리와 만료 purge 함수가 있습니다.

## 목표 구조와 보존 원칙

```text
브라우저 ──같은 출처──> Cloudflare Worker (Hono + Better Auth)
                               ├─ Neon PostgreSQL: 계정·커뮤니티 데이터
                               ├─ R2: 비공개 사용자 사진
                               └─ 정적 파일: 지도·일정·랜딩 페이지
```

- React/Vite 프런트엔드, 지도 데이터 ID, 게시물·후기·사진·신고·이의제기 의미를 유지합니다.
- Better Auth는 새 로그인·세션을 맡고, Hono는 인증(누구인지 확인)과 인가(그 행동을 할 권한이 있는지 확인)를 서버에서 검사합니다.
- Neon에는 현재 PostgreSQL 업무 데이터를 옮겨 SQL 관계·제약을 보존합니다. Cloudflare Worker API만 DB에 접근하며 브라우저가 DB에 직접 접속하지 않습니다.
- R2는 private 객체 저장소로 사용하고, Worker가 공개 상태·신고자별 숨김·관리자 상태를 검사해 사진을 전달합니다.
- 기존 Supabase 사용자 UUID와 X/Google/Kakao의 안정적인 provider 계정 ID를 기준으로 연결합니다. 이메일·표시 이름만 같다는 이유로 계정을 합치지 않습니다. 계정 연결은 로그인한 사용자가 직접 승인하게 하고 이전 세션은 새로 발급합니다.
- Supabase의 RLS는 사라지는 게 아니라 서버의 소유자·관리자 검사, DB 제약·트랜잭션, 비밀 접근 제어로 옮겨 다시 구현합니다.

## 이번 로컬 파일럿 변경

- 새 분리 브랜치 `codex/backend-workers-migration`에서만 작업합니다.
- Docker Compose에 로컬 PostgreSQL을 추가했습니다. DB 포트는 `5433`이며 컨테이너를 내려도 전용 볼륨에 테스트 데이터가 남습니다.
- Worker 설정은 정적 사이트와 `/api`를 같은 출처에서 처리하고, 로컬 개발에서는 Docker DB를 Hyperdrive의 `localConnectionString`으로 연결합니다.
- Hono의 상태 확인, provider 설정 목록, 세션 ID 확인, 공개 방명록·후기 조회, 비공개 R2 이미지 전달, 방명록·후기 작성·수정과 일정 좋아요, 신고·관리·이의제기 파일럿을 만들었습니다.
- 쓰기 API는 현재 공개 안내 동의 버전, 커뮤니티 중단 설정, DB 400 MiB 경계, 시간당 계정별 횟수 제한과 작성자·공개 상태를 확인합니다. 후기는 일정당 계정 하나만 허용하고 별점을 검사합니다. 좋아요는 트랜잭션 잠금으로 계정별 상태를 전환합니다. Turnstile은 Cloudflare Siteverify로 fail-closed 검증하고 인증·입력·제한·서비스 장애를 별도 상태와 `{code,error}` 응답으로 반환합니다.
- Better Auth의 X scope는 `users.read`만 사용하고 이메일 조회 endpoint를 호출하지 않도록 프로필 매핑을 덮어씁니다. Kakao는 프로필 닉네임·이미지만 요청합니다. 둘 다 이메일 동의를 요구하지 않습니다.
- OAuth 토큰은 암호화 설정을 하고, 매칭 이메일이나 이름으로 계정을 자동 연결하지 않게 했습니다.
- 로컬 PostgreSQL에만 Better Auth 및 커뮤니티용 스키마 초안을 추가했습니다. 기존 Supabase 원격 DB, Storage, Edge Function, GitHub Pages 배포는 건드리지 않았습니다.
- 신고 API는 로그인한 사용자의 중복·자기 신고를 막고, 신고한 사용자의 피드에서 해당 글을 숨깁니다. 관리자만 신고 목록을 보고 숨김 사유를 기록하거나 신고를 기각할 수 있습니다.
- 관리자가 게시물을 숨기면 7일 동안 보존합니다. 작성자가 기한 안에 이의제기를 제출할 수 있고, 관리자가 승인하면 자동 복원합니다. 기각하면 본문과 첨부 사진을 삭제하고 사유 안내만 7일 보존합니다. 작성자는 내 게시글 API에서 자신의 글과 이의제기 결과를 확인할 수 있습니다.
- 15분 간격으로 실행되도록 Wrangler Cron을 설정했습니다. 만료 purge는 제한된 배치로 처리하며, 이의제기 검토 중인 글은 정리 대상에서 제외합니다.
- Better Auth의 계정 삭제 API를 활성화하고 삭제 전 훅을 연결했습니다. 최근 24시간 내 로그인한 세션만 탈퇴할 수 있으며, 글·후기는 익명으로 보존하고 좋아요·작성자 이의제기·소유 사진·업로드 예약을 정리합니다. Better Auth가 사용자·소셜 계정·세션을 삭제하고 FK 규칙에 따라 프로필·관리자 권한·신고자 연결을 정리합니다.

### 현재 미완료

- 로컬 PostgreSQL에서 세 마이그레이션이 실행됐고 Better Auth 및 커뮤니티 테이블이 생성되는 것을 확인했습니다. Better Auth 실제 OAuth 로그인은 아직 검증하지 않았습니다.
- 로그인 callback은 로컬 provider 자격 증명이 없으므로 아직 시험하지 않았습니다.
- Worker 프런트엔드는 아직 Supabase SDK를 사용합니다. 새 API로 바꾸는 작업은 인증·권한·기능별 검증 후 작은 단위로 진행합니다.
- 방명록·후기 작성/수정, 좋아요, 사진 업로드·삭제, 신고·관리, 이의제기·복원·만료 정리, 계정 삭제를 로컬 Worker 파일럿에 구현했습니다. 주입형 단위 테스트와 Docker PostgreSQL 통합 테스트로 데이터 권한·보존·탈퇴 흐름을 점검했고, 이미지 객체는 실제 R2 대신 메모리 대체물로 시험했습니다. 공개 프런트엔드는 아직 Supabase에 연결되어 있습니다. 실제 R2, 브라우저 연결, OAuth callback과 기존 데이터 이관은 미완료입니다.
- Neon/Hyperdrive와 실제 R2 연결, OAuth 앱 callback 변경, 기존 사용자·글·사진 이관은 하지 않았습니다.

## 단계별 완료 기준

1. **기준선·백업:** 테이블·RPC·RLS·스토리지 정책·사용량을 기능별로 확인하고, 암호화 백업을 복구 시험합니다.
2. **학습 API:** 로컬 DB와 Hono에서 `/health`, 인증 세션, 공개 읽기만 먼저 통과시킵니다. 현재 작성된 route 테스트·DB smoke 결과를 확인합니다.
3. **기능 이전:** 방명록→후기/좋아요→사진/한도→신고·관리/이의제기→계정 삭제 순서로 소유자·관리자 권한, 트랜잭션, 사용량 한도를 테스트합니다.
4. **인증·데이터 시험 이관:** 기존 계정 ID, provider ID, 프로필, 모든 콘텐츠 관계, 사진 key/hash, 만료·appeal 결과를 staging으로 반복 복사해 비교합니다.
5. **단일 전환:** 새 서비스에서 모든 기능과 복구·롤백 시험을 통과한 뒤 쓰기를 잠시 정지하고 최종 변경분을 옮겨 새 Worker를 쓰기 원본으로 바꿉니다. 30일간 Supabase 백업을 보존합니다.
6. **정리:** 안정화 후에만 개인정보 안내·README·Notion을 새 주소와 처리 업체에 맞추고, 별도 확인 후 Supabase 자료와 비밀값을 정리합니다.

## 2026-10-31 파일럿 검증 상태

- 통과: Worker TypeScript 타입 검사, 기본 단위 테스트와 격리된 로컬 PostgreSQL 통합 테스트(방명록·후기·좋아요·합성 WebP 업로드/삭제·신고/숨김/복원/이의제기 승인·기각·기한 정리·계정 탈퇴 익명화 및 사용량 정산), ESLint, Prettier, 기존 프런트엔드 production build, Wrangler Worker dry-run bundle.
- 통과: Wrangler 로컬 실행에서 `/health`, `/api/health`, `/api/v1/providers` 응답, 알 수 없는 API의 JSON 404, `/`, `/archive`, `/guestbook`, 일정 상세 URL의 SPA fallback.
- 통과: 빈 로컬 PostgreSQL에서 3개 SQL 마이그레이션 적용을 확인했습니다. Better Auth와 커뮤니티 테이블 생성, 방명록·후기 읽기 200, 없는 미디어 404, 비로그인 세션 401을 확인했습니다.
- DB 연결은 Cloudflare 요청 수명에 맞춰 요청마다 만들고 종료하도록 수정했습니다. 전역 `pg.Pool` 캐시 사용 시 로컬 반복 조회에서 런타임 취소가 간헐적으로 발생해 이를 제거했습니다.
- 단위 테스트는 Turnstile의 정상·거부·잘못된 호스트·연결 실패, 로그인·약관·작성자 경계, 글·후기 저장/수정·중복 후기·좋아요 토글·잘못된 입력·요청 제한을 확인합니다. 로컬 PostgreSQL 통합 테스트는 격리된 QA 계정과 콘텐츠를 사용하고 테스트 뒤 글·사진·신고·이의제기·사용량 데이터를 정리합니다. 실제 Cloudflare Siteverify는 호출하지 않습니다.
- 신고·관리·이의제기 통합 검증에서는 자기 신고와 타인 권한 거부, 신고자 피드 숨김, 관리자 전용 목록·조치, 숨김 사진 접근 경계, 승인 시 자동 복원, 기각 시 글·사진 삭제와 7일 사유 보존, 만료 purge 및 pending appeal 보존을 확인했습니다. QA 자료와 사진 사용량은 0으로 정리됐습니다.
- 계정 탈퇴 통합 검증은 Better Auth의 실제 `POST /api/auth/delete-user` handler를 사용했습니다. 24시간보다 오래된 세션은 400으로 거절되고 계정과 사진이 유지되며, 새 세션은 200으로 처리됐습니다. 글·후기 익명화, 숨김 상태와 조정 사유 보존, 사진·업로드 예약 삭제와 저장량 정산, 좋아요·이의제기 삭제, 소셜 계정·세션·프로필·관리자 권한 정리, 신고자 ID 분리를 확인했습니다. 테스트 뒤 QA 자료를 정리했습니다.
- 미실행: 실제 OAuth callback, 실제 Cloudflare Siteverify, Neon Hyperdrive, 실제 Cloudflare R2 bucket, 프런트엔드 API 전환, 기존 사용자·게시물·사진 이관, 새 Worker 배포 및 GitHub Pages 전환. Cron은 Wrangler 설정에 추가했지만 실제 배포 환경에서 실행되는지 검증하지 않았습니다.
- 빌드에는 기존의 대형 지도 번들 경고와 Supabase client dynamic import 경고가 남아 있습니다. 이번 파일럿은 기존 프런트엔드 의존성을 아직 옮기지 않아 해당 경고의 원인이 유지됩니다.
- `npm audit`은 npm registry DNS 조회 실패로 이번 검증에서 완료되지 않았습니다. 이전 로컬 설치에서 production dependency audit은 취약점 0건이었지만, 이를 현재 시점의 원격 최신 감사 결과로 간주하지 않습니다.

이 점검은 설계·로컬 파일럿 단계이며 Supabase 의존도 제거 완료를 의미하지 않습니다. OAuth 승인 URL과 callback 경로 생성은 아래 테스트로 확인했지만 실제 provider 로그인은 자격 증명이 없어 미검증입니다. 다음 백엔드 단계는 아래 API 계약 차이를 기준으로 필요한 Worker route와 typed client 이전 순서를 정하는 것입니다.

## 2026-10-31 OAuth URL 및 프런트엔드 계약 대조

- Better Auth 설정을 옵션 생성 함수로 분리해 실제 런타임 설정을 그대로 테스트할 수 있게 했습니다. 테스트에는 Better Auth 메모리 어댑터와 가짜 OAuth client 값만 사용합니다.
- OAuth URL 생성 테스트 통과: Google, X, Kakao 모두 `https://archive.example.test/api/auth/callback/{provider}` 같은 동일 출처 callback과 state를 생성합니다. X 요청 scope는 `users.read` 하나이며 `tweet.read`, `email`, `offline.access`는 포함하지 않습니다. 테스트는 승인 URL 생성까지만 하며 provider로 네트워크 요청을 보내지 않습니다.
- 로컬 `.dev.vars`와 루트 `.env`에는 OAuth 자격 증명이 없어 실제 provider 로그인·callback은 검증하지 않았습니다. callback URL 생성 테스트를 실제 OAuth 성공으로 간주하지 않습니다.

### 프런트엔드와 Worker API 계약 차이

| 기능                  | 현재 프런트엔드 계약                                                                | Worker 파일럿                                                                   | 이관 전 남은 작업                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 공개 방명록·후기      | Supabase RPC가 행 배열을 반환하고 `media[].signed_url` 사용                         | 기존 UI와 같은 행 배열·`media[].signed_url`; Worker 경로가 매번 권한 확인        | 응답 모양은 정렬됨. Supabase signed URL과 Worker의 보호된 미디어 경로 차이를 client 계층에서 정리       |
| 방명록·후기 작성/수정 | `community-api` action 이름과 JSON payload, 사진은 Supabase Function multipart 요청 | 별도 REST 경로와 `/api/v1/media` multipart 요청                                 | API client, 경로, 본문, 오류 처리, 여러 장 업로드 흐름을 함께 전환                                    |
| 약관·프로필           | 동의 기록 action, 프로필 조회, `save_my_display_name` RPC                           | `GET/PATCH /api/v1/me/profile`, `POST /api/v1/me/community-terms`               | 경로별 로컬 요청 테스트는 통과. Better Auth 실제 브라우저 세션 연동은 프런트엔드 이전 때 확인         |
| 좋아요·내 후기        | 통계 RPC는 좋아요 수·내 좋아요·내 후기 ID, 별도 RPC로 내 후기 조회                  | `GET /api/v1/schedules/:id/reactions`, `GET /api/v1/schedules/:id/reviews/own`  | 로컬 경로 테스트 통과. 실제 세션과 UI 연결은 API client 이전 때 확인                                  |
| 콘텐츠 삭제·미디어    | action 기반 콘텐츠 삭제와 사진 삭제                                                 | `DELETE /api/v1/content/:type/:id` 추가. 공개 본인 글만 삭제하고 숨김 글은 보존 | 로컬 route 테스트 통과. 실제 로컬 DB/R2 연결과 UI 계약은 이후 확인                                    |
| 신고·숨김·이의제기    | action 기반 요청 및 배열/결과 객체                                                  | `/api/v1/reports`, `/admin/*`, `/content/*/appeals` REST 경로 있음              | 경로·본문은 typed client에서 매핑하고 작성자 결과 응답을 타입으로 고정                                |
| 운영 설정·관리자 확인 | 공개/관리 설정 RPC, 관리자 claim·권한 RPC                                           | `/api/v1/admin/settings` 조회·세 스위치 변경 및 `admin_members` 권한 검사       | 로컬 경로 검증 필요. 관리자 등록은 API가 아닌 제한된 DB 운영 절차로 관리. UI 연결은 후속 단계         |
| 계정 삭제             | Supabase Edge Function `delete-account` action                                      | Better Auth `POST /api/auth/delete-user`                                        | 프런트엔드를 Better Auth client 요청과 세션 만료 UX로 전환                                            |

현재 프런트엔드는 계속 Supabase를 사용합니다. Worker에는 프로필 조회·표시 이름 변경·현행 약관 동의, 좋아요 통계, 본인 공개 후기 조회, 작성자 게시물 삭제, 관리자 운영 설정 조회·변경 API를 추가했지만 프런트엔드 API client는 아직 연결하지 않았습니다. Worker 공개 방명록·후기 목록의 응답 모양은 기존 화면 데이터 배열에 맞췄습니다. Worker API·문서만 로컬에서 변경했으며 DB 스키마와 운영 배포는 변경하지 않았습니다.

## 2026-10-31 백엔드 안내 주석 및 관리자 설정 API

- Worker 모듈, 인증·세션, 공개 읽기와 사용자 쓰기 경로, 사진 예약·정산, 신고·숨김·이의제기, 계정 탈퇴와 로컬 SQL 테이블에 한국어 안내 주석을 보강했습니다. 주석은 문법 설명보다 기능의 운영 목적, 권한, 보존 기간과 외부 저장소 경계를 설명합니다.
- 관리자 설정 API는 `GET/PATCH /api/v1/admin/settings`입니다. 관리자 확인 후 기능 스위치 세 가지와 실제 DB·사진 저장량을 조회하며, 수정은 세 boolean 스위치만 받습니다. API를 통해 저장 한도나 관리자 권한을 임의로 변경할 수 없습니다.
- Worker는 Cloudflare 계정 전체의 실시간 전송량을 읽지 않습니다. 기존 UI 계약과 호환되는 전송량 경고·중단 값은 운영 기준값으로만 제공하며, 실제 계량값으로 취급하지 않습니다.
- 현재 변경은 로컬 파일럿에 한정됩니다. Supabase, 프런트엔드, 실제 R2 버킷, OAuth provider 설정 또는 원격 배포에는 연결하지 않았습니다. 관리자 계정은 별도 통제된 DB 운영 절차로만 등록해야 합니다.
- 공개 목록 경로는 기존 UI와 같은 `is_mine` boolean 및 media 배열을 반환하도록 맞췄습니다. `media[].signed_url`에는 보호된 Worker 미디어 경로가 들어가며, 실제 R2 파일은 매 요청에서 게시물 상태·신고자·관리자 권한을 다시 확인한 뒤 전달합니다. Supabase 서명 URL과는 수명·접근 방식이 다릅니다.
- 프런트엔드용 typed Worker client의 공개 목록 메서드와 오류 변환기를 추가했지만 아직 React 페이지에 연결하지 않았습니다. 소셜 로그인·세션이 Supabase와 Worker 사이에 공유되지 않기 때문에, 실제 목록 전환은 로그인 세션과 쓰기 경로를 함께 준비한 뒤 진행합니다.
