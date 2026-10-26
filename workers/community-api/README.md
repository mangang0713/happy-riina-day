# Hono + Cloudflare Workers 학습 API

현재 서비스의 `community-api` Edge Function과 나란히 동작을 익히는 격리된 실험 API입니다. 이 Worker는 `/health`와 Supabase 로그인 토큰을 검증하는 읽기 전용 `/api/me`만 제공합니다. 방명록, 후기, 사용자 데이터, DB 테이블에는 쓰지 않으며 기존 서비스 화면에서도 호출하지 않습니다.

## 로컬 실행

1. 저장소 루트에서 `workers/community-api/.dev.vars.example`을 복사해 `workers/community-api/.dev.vars`를 만듭니다.
2. `.dev.vars`에 기존 로컬 설정의 Supabase URL과 publishable key를 입력합니다. 두 값은 브라우저용 공개 설정값이며, service-role key나 비밀 키는 넣지 않습니다.
3. 저장소 루트에서 `npm run worker:dev`를 실행합니다. 기본 주소는 `http://localhost:8787`입니다.
4. `http://localhost:8787/health`에서 실행 상태를 확인합니다. Authorization 헤더 없이 `/api/me`를 호출하면 `401`을 반환합니다. 유효한 Supabase access token을 보낸 경우에만 사용자 ID를 돌려줍니다.

## 실험 범위

- Supabase OAuth 로그인은 기존 프로젝트를 그대로 사용합니다.
- Worker가 access token을 Supabase Auth 서버에 보내 유효성을 확인합니다. 자체 JWT 서명 검증이나 서비스 역할 키를 사용하지 않습니다.
- 이 Worker를 Cloudflare에 배포하거나 기존 프런트엔드와 연결하지 않습니다. 기능 검증 후 비용·보안·유지보수를 비교할 때 다음 범위를 정합니다.
