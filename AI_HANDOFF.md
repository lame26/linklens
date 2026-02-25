# LinkLens AI 인수인계 가이드

이 문서는 **초보 사용자 대응용**으로, 다음 AI가 같은 기준으로 문제를 진단/수정할 수 있도록 정리한 운영 절차입니다.

## 1) 커뮤니케이션 원칙
- 사용자를 초보자로 가정하고, 항상 **클릭 경로/입력값/성공 기준**을 단계별로 안내합니다.
- 설명은 반드시 아래 3분류로 나눕니다.
  - 코드 이슈
  - 배포(설정) 이슈
  - 인프라(Supabase/Worker) 이슈
- 한 번에 대규모 변경을 제안하지 않습니다.
  - `재현 → 원인 확인 → 수정 → 검증` 순서 고정
- 추측하지 않습니다.
  - 먼저 HTTP status와 response body를 수집하고 판단합니다.

## 2) 현재 구조 핵심
- 프론트 런타임 설정(HTML 메타 태그):
  - `LL_SUPABASE_URL`
  - `LL_SUPABASE_KEY`
  - `LL_WORKER_BASE_URL`
- Supabase 초기화: `js/supabase.js`
  - `supabase` 전역이 없으면 `sb = null` 방어
- Worker 엔드포인트:
  - 미리보기: `/preview`
  - 분석: `/analyze`
- DB 접근 스코프:
  - `requireAuthContext`
  - `.eq('user_id', userId)` 강제

## 3) 최근 변경 사항 요약
- 저장 중복 클릭/무한 로딩 방지
  - `state.savingArticle` 도입
  - 저장 플로우에서 `finally` 복구 보장
- 저장과 AI 분석 분리
  - 저장 성공 후 AI 분석을 비동기 후처리로 전환
  - Worker 500이어도 저장 UI 블로킹 방지
- 인증 초기화 레이스 완화
  - `sawInitialSession`로 boot/auth-state 중복 처리 완화
- 로그아웃 시 로컬 스토리지 과삭제 완화
  - `ll_*` 전체 삭제 제거
  - auth 관련 키만 삭제

## 4) 현재 장애의 본질(코드 외부 의존성)
### A. Worker 500
Worker는 요청마다 Bearer 토큰 검증 및 환경변수에 의존합니다.
- `SUPABASE_URL`/`SUPABASE_ANON_KEY` 누락 시 500 가능
- `/analyze`는 `OPENAI_API_KEY` 누락 시 500
- CORS의 `ALLOWED_ORIGINS`는 JSON이 아니라 **콤마 구분 문자열**

### B. 로그인 후 0건
조회는 `user_id` 필터 강제이므로, 아래 불일치 시 0건으로 보일 수 있습니다.
- 테이블 스키마 불일치
- RLS 정책 불일치
- 기존 데이터의 `user_id` 누락/불일치

### C. 휴지통 오해 가능성
현재 휴지통은 서버 저장이 아니라 로컬 저장 기반입니다.
- `moveToTrash`: DB row 삭제 + `local state.trash`로 이동
- 브라우저/기기 변경 시 휴지통 미노출 가능


### D. CSP `unsafe-eval` 경고(콘솔)
다음 메시지 1건만 있고 기능이 정상 동작하면, 애플리케이션 코드 결함이 아니라 **브라우저 확장 프로그램/외부 스크립트** 영향일 수 있습니다.
- 메시지 예: `Content Security Policy ... blocks the use of eval`

확인 순서(초보자용):
1. 크롬 시크릿 창(확장 프로그램 비활성)에서 동일 동작 재현
2. 같은 기능이 정상 동작하면 확장 프로그램 영향으로 판단
3. 그래도 재현되면 Network에서 실패 요청 status/body를 수집해 Worker/Supabase 점검으로 진행

주의:
- 문제 회피를 위해 CSP에 `unsafe-eval`을 추가하지 않습니다(보안 위험).
- 우리 코드에서는 `eval`, `new Function`, 문자열 기반 `setTimeout/setInterval`을 사용하지 않는지 먼저 확인합니다.

## 5) 다음 턴 필수 점검 체크리스트
### Cloudflare Worker Variables
- `SUPABASE_URL` (Text)
- `SUPABASE_ANON_KEY` (Secret)
- `OPENAI_API_KEY` (Secret)
- `ALLOWED_ORIGINS` (Text, 예: `https://linklens.pages.dev`)
- `RATE_LIMIT_PER_MIN` (Text, 예: `30`)

### 배포/운영 확인
- Worker 재배포 후 `/preview`, `/analyze` 응답 확인
- Supabase 테이블/컬럼(`user_id`) 및 RLS 정책 확인
- 기존 데이터 `user_id` 누락 점검 (누락 시 마이그레이션)
- 이중 트리 구조 반영 여부 확인 (`js/*` 와 `LinkLens/js/*`)

## 6) 진단 시작 파일(우선순위)
1. `js/app.js` (프론트 부트/전역 바인딩)
2. `js/auth.js` (인증 부트/세션 이벤트)
3. `js/db.js` (DB 접근 스코프)
4. `js/actions.js` (저장/AI 후처리)
5. `js/workerClient.js` (Worker 호출)
6. `worker.js` (Worker 환경 의존)

## 7) 작업 순서 템플릿
1. **재현**: 증상 재현 + 콘솔/네트워크 로그 수집
2. **원인 확인**: 코드/배포/인프라 분리 진단
3. **수정**: 최소 변경 1건 적용
4. **검증**: 동일 시나리오 재실행 + 성공 기준 체크
5. **보고**: 사용자가 따라 할 다음 액션 3줄 이내 요약
