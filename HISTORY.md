# HISTORY

LinkLens 프로젝트 변경 이력입니다.

## 2026-03-04

### 문서 업데이트

- `README.md` 신규 작성
  - 프로젝트 개요/소개, 기능, 기술 스택, 구조, 배포 설정 정리

- `HISTORY.md` 신규 작성
  - 안정화 작업 히스토리 기록 시작

- `README.md` 협업 메모 섹션 추가
  - 사용자 협업 패턴(요청/커뮤니케이션/작업 선호) 문서화
  - 운영 환경 특성(Pages/Worker/Supabase, `js`/`LinkLens/js` 동기화) 반영
  - 반복 이슈 유형 및 대응 원칙(fallback 우선, 배포 검증 우선) 정리

### 안정화 작업 (세션/저장/배포)

- 버튼 전역 핸들러 등록 순서 및 초기화 보호 로직 강화
  - `Object.assign(window, ...)` 초기화 순서 문제 보정
  - 초기화 단계별 예외 격리(`try/catch`) 적용

- Supabase 클라이언트 가드/인증 경로 보강
  - `supabase` 전역 미존재 시 안전 처리(`sb = null`)
  - 인증/세션 함수에 null 가드 추가

- 경로 동기화
  - `js/`와 `LinkLens/js/` 간 불일치 파일 동기화
  - 모듈 import를 `./supabase.js` 직접 참조로 정리

- Cloudflare Worker CORS/Origin 처리 강화
  - `ALLOWED_ORIGINS` 처리 보강
  - 기본 허용 Origin 및 와일드카드 매칭 지원

- 저장 흐름 안정화
  - DB read/write 타임아웃 분리
  - `dbIns` 타임아웃 시 세션 refresh 후 1회 재시도
  - 저장 중 UI 잠김 상태 복구 보강

- 새로고침 후 데이터 복구 개선
  - 사용자별 기사/컬렉션 캐시(`ll_cache_<userId>`) 저장
  - DB 조회 timeout/빈결과 시 캐시 유지 및 즉시 표시
  - 세션 복구 시 빠른 재동기화 타이머 추가

- 빠른 로그아웃/재로그인 경쟁 상태 완화
  - 지연된 `SIGNED_OUT` 이벤트 무시 로직 추가
  - signOut 지연 시에도 로컬 정리 우선 처리

- Worker AI 분석 오류 완화
  - OpenAI 응답 JSON 파싱 실패 시 fallback 응답(500 방지) 로직 추가
  - 프론트에서 레거시 Worker 500(`parse failed`/`connection failed`) fallback 처리

### 참고

- `SES Removing unpermitted intrinsics`는 일반적으로 브라우저 확장/보안 스크립트에서 발생하는 경고로,
  LinkLens 핵심 저장/조회 로직의 직접 원인은 아님.
