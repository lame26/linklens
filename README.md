# LinkLens

LinkLens는 뉴스/아티클 URL을 저장하고, AI로 제목/요약/키워드를 보강해 개인 아카이브로 관리하는 웹 앱입니다.

## 프로젝트 소개

- URL을 빠르게 저장하고 읽기 상태/즐겨찾기/휴지통으로 정리할 수 있습니다.
- 컬렉션(태그성 분류)과 카테고리 필터로 저장한 기사를 관리할 수 있습니다.
- Cloudflare Worker 기반 AI 분석 API를 통해 요약/키워드/카테고리 보강을 수행합니다.
- Supabase Auth + DB를 사용해 사용자별 데이터가 분리됩니다.

## 주요 기능

- 로그인/회원가입/로그아웃
- 기사 저장, 수정(메모/상태/별점), 삭제/복원
- 카테고리/컬렉션 필터, 검색, 정렬, Grid/List 뷰
- AI 미리보기(제목 추정), AI 분석(요약/키워드/카테고리)

## 기술 스택

- Frontend: Vanilla JS (ES Modules), HTML, CSS
- Auth/DB: Supabase
- AI Backend: Cloudflare Worker + OpenAI API
- Deploy: Cloudflare Pages (frontend), Cloudflare Workers (API)

## 디렉터리 구조

- `index.html`: 메인 UI
- `js/`: 프론트엔드 모듈
- `worker.js`: Worker API 엔드포인트(`/preview`, `/analyze`)
- `LinkLens/`: Pages 루트 변형본(동기화본)

## 환경/배포 설정

- Frontend 메타 값 (`index.html`)
  - `LL_SUPABASE_URL`
  - `LL_SUPABASE_KEY`
  - `LL_WORKER_BASE_URL`
- Worker 환경변수
  - `OPENAI_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `ALLOWED_ORIGINS`

## 실행/개발 메모

이 저장소는 빌드 도구 없이 정적 파일 + 모듈 구조로 동작합니다.
Cloudflare Pages에 배포할 때 루트 디렉터리와 산출 경로를 실제 파일 위치와 일치시켜야 합니다.

## 협업 메모 (효율 작업용)

아래 항목은 실제 운영/협업 과정에서 확인된 패턴으로, 다음 작업 시 우선 적용합니다.

- 사용자 요청 성향
  - 문제 재현 후 바로 코드 수정 + 커밋/푸시까지 한 번에 진행하는 흐름 선호
  - 설명은 짧고 명확하게, 즉시 실행 가능한 액션 중심 선호
  - 한국어 커뮤니케이션 선호

- 운영 환경 특성
  - Frontend: Cloudflare Pages 도메인 변경 가능성 존재 (`*.pages.dev`)
  - Backend: Cloudflare Worker(`linklens-ai`) + Supabase 조합
  - `js/`와 `LinkLens/js/`가 동시에 존재하므로 변경 시 동기화 필수

- 자주 발생한 이슈 유형
  - 초기 세션 복구 지연으로 새로고침 직후 DB 연결이 늦어지는 현상
  - Worker 배포 버전 불일치(구버전 오류 문구가 콘솔에 남는 현상)
  - 빠른 로그아웃/재로그인 시 auth 이벤트 경쟁 상태

- 작업 원칙
  - 저장/인증 흐름은 "실패해도 UI가 멈추지 않도록" fallback 우선
  - Worker 500은 가능한 범위에서 프론트 fallback으로 사용자 흐름 유지
  - 배포 이슈는 코드 수정과 별개로 "Pages/Worker 최신 배포 반영 여부"를 먼저 검증

## 상태

현재 안정화 작업(인증/세션/저장 흐름/타임아웃/캐시 복구/Worker 오류 완화)을 진행 중이며,
상세 변경 이력은 `HISTORY.md`를 참고하세요.
