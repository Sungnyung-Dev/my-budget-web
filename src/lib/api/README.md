# Ledger 조회 API

`client.ts`는 조회 전용 HTTP 클라이언트, `ledgerApi.ts`는 전체 Ledger 조회 함수입니다. 인접한 iOS의 `src/api/client.ts`·`ledgerApi.ts`와 백엔드의 Ledger 라우트·서비스·DTO를 읽기 전용으로 확인했습니다. React나 저장소에 의존하지 않으며 모듈을 import하는 것만으로 요청하지 않습니다.

## 계약

- `GET /api/v1/ledger`, 요청 본문·쿼리 파라미터 없음. 정상 응답은 HTTP 200의 `{ version: 1, categories: Category[], transactions: Transaction[] }`이며 envelope·필터·페이지네이션이 없습니다.
- 서버는 전체 카테고리와 거래를 동일 시점의 스냅샷으로 반환합니다. 카테고리는 유형 → 이름 → ID 오름차순, 거래는 날짜 내림차순 → ID 오름차순입니다. 클라이언트는 응답 순서·문자열 ID·`YYYY-MM-DD` 날짜·숫자 금액을 그대로 유지합니다.
- 기존 `validateLedger(unknown)`로 버전·필드·날짜·정수 금액·전체 합계·중복·카테고리 참조 및 유형을 검사합니다. 정상 빈 거래 배열 및 카테고리까지 모두 빈 Ledger를 허용합니다. 실패·204·빈 본문·잘못된 JSON을 빈 배열로 대체하지 않습니다.
- 백엔드 오류 형식은 `{ error: { code, message } }`입니다. 클라이언트는 HTTP 상태만 보존하고 오류 본문을 읽거나 노출하지 않습니다. 네트워크/검증기의 원문 오류와 실제 Ledger 내용도 기록하지 않습니다.

## 사용

```ts
import { ApiError, apiClient } from './lib/api/client.ts'
import { getLedger } from './lib/api/ledgerApi.ts'

const controller = new AbortController()
try {
  const ledger = await getLedger(apiClient, { signal: controller.signal })
  // 검증을 통과한 ledger를 다음 단계의 조회 상태 관리 계층에 전달합니다.
  void ledger
} catch (error) {
  if (error instanceof ApiError && error.code !== 'ABORTED') {
    // error.code, error.status, 안전한 error.message로 실패 상태를 처리합니다.
  }
}
// 컴포넌트 해제·조회 교체 시 controller.abort()로 취소할 수 있습니다.
```

취소가 필요 없으면 `await getLedger()`로 조회합니다. `createApiClient({ timeoutMs, fetchImpl })`로 대기 시간과 테스트용 fetch를 주입할 수 있습니다. 공통 `client.get(path, validate, { signal }?)`는 선행 `/`가 있는 동일 출처 상대 경로만 허용합니다. 절대 URL·`//`·공백·역슬래시·fragment는 설정 오류입니다. 생성·수정·삭제 메서드는 제공하지 않습니다.

기본 대기 시간은 **10,000ms**이며 요청 시작부터 헤더와 본문 수신 완료까지 같은 타이머를 유지합니다. 타임아웃 또는 외부 `AbortSignal`은 내부 fetch 신호를 중단합니다. fetch가 취소를 무시해도 반환 Promise는 종료되고 뒤늦게 도착한 데이터를 검증하지 않습니다. 완료 시 타이머·외부 신호 리스너를 정리하며 동시 요청의 취소는 서로 독립적입니다. 자동 재시도는 없습니다.

| `ApiError.code` | 의미 | `status` |
| --- | --- | --- |
| `HTTP` | 2xx가 아닌 HTTP 응답 | HTTP 상태 |
| `NETWORK` | 연결 실패 또는 본문 수신 실패. 브라우저에서는 CORS 실패도 포함될 수 있음 | 없음 |
| `TIMEOUT` | 설정된 대기 시간 초과 | 없음 |
| `INVALID_RESPONSE` | JSON이 필요한데 204/205, 잘못된 JSON 또는 도메인 검증 실패 | HTTP 상태 |
| `CONFIGURATION` | 잘못된 상대 경로 또는 대기 시간(정수 1–2,147,483,647ms) | 없음 |
| `ABORTED` | 호출자가 취소한 조회 | 없음 |

`credentials: 'omit'`으로 쿠키를 전송하지 않고 `cache: 'no-store'`로 브라우저 HTTP 캐시를 사용하지 않습니다. 인증 헤더·API 키·비밀번호·브라우저 환경변수는 추가하지 않았습니다. 기존 Service Worker 설정은 변경하지 않았으며 API 응답 캐시·오프라인 저장은 없습니다.

## 개발과 배포 경로

`npm run dev`에서는 브라우저의 `/api/v1/ledger` 요청을 Vite가 `https://budget-api.ecoma.kro.kr/api/v1/ledger`로 전달합니다. `/api`를 제거하지 않으며 `changeOrigin: true`, TLS 인증서 검증(`secure: true`)을 사용합니다. 브라우저는 개발 서버의 동일 출처로 요청하므로 백엔드의 브라우저 CORS 허용 설정을 전제로 하지 않습니다.

**개발 프록시는 `dist/`에 포함되지 않습니다.** 실제 배포에서는 웹앱과 같은 HTTPS 출처의 `/api`를 기존 백엔드로 전달하는 배포 호스트의 reverse proxy가 별도로 필요합니다. `/api`에 SPA HTML을 반환하면 `INVALID_RESPONSE`가 발생합니다. 별도 출처의 API를 브라우저에서 직접 부르도록 바꾸면 HTTPS·CORS 조건을 따로 검토해야 합니다. 이번 작업에서는 운영 서버·DB·Nginx 설정을 바꾸지 않았습니다.

Vite preview는 기본적으로 `server.proxy`를 상속하므로, 혼동을 막기 위해 `preview.proxy: {}`를 명시했습니다. `npm run preview`는 정적 앱/PWA 확인용이고 API 프록시는 제공하지 않습니다. 개발/preview 서버는 실제 배포 서버가 아닙니다. 참고: [Vite server.proxy](https://vite.dev/config/server-options#server-proxy), [preview.proxy](https://vite.dev/config/preview-options#preview-proxy).

현재 백엔드에는 **인증·사용자별 접근 제어가 없습니다.** 주소에 접근할 수 있는 요청자를 구분하지 못하는 제한이 있으며, 프록시나 프론트엔드 코드만으로 인증이 생기지는 않습니다. 인증 설계·서버 변경은 후속 범위입니다.

## 검증과 다음 단계

`npm run typecheck`, `npm test`, `npm run build`로 검사합니다. `tests/api.test.ts`의 모의 fetch·HTTP Response 및 가상 타이머는 정상/빈 Ledger, 오류 분류, 본문 수신 타임아웃, 호출자 취소, 동시 요청과 정리를 검사합니다. 단위 테스트는 실제 네트워크를 사용하지 않습니다. 기존 도메인 테스트 104개와 새 API 테스트 59개, 총 163개가 통과했습니다.

2026-11-16 개발 서버의 앱 HTTP 200과 Vite 프록시를 통한 읽기 전용 `GET /api/v1/ledger` HTTP 200 및 웹 도메인 검증 통과를 확인했습니다. 실제 응답은 메모리에서만 검증했으며 거래 내용은 로그·파일·문서에 기록하지 않았습니다. 브라우저 화면 연결·실제 배포 출처의 라우팅·실제 iPhone 네트워크 동작은 이번 검증에 포함하지 않습니다.

현재 조회 상태(`loading`·`ready`·`error`·`refreshing`)와 취소/재조회는 [React 상태 계층](../../state/README.md)에 연결했습니다. 위 API 단독 검증에 더해 상태·화면 어댑터 테스트 22개를 추가했고 전체 `npm test`는 185개입니다. 정상 빈 데이터와 조회 실패를 분리하며 실패 시 빈 Ledger를 생성하지 않습니다. 다음 단계는 별도 범위의 CRUD이며 로컬 저장은 구현하지 않습니다.
