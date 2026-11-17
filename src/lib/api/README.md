# Ledger HTTP API

`client.ts`는 공통 HTTP 클라이언트, `ledgerApi.ts`는 전체 Ledger 조회, `transactionApi.ts`·`categoryApi.ts`는 쓰기 함수입니다. 인접한 iOS의 API·Provider와 백엔드의 라우트·검증·서비스 계약을 읽기 전용으로 확인했습니다. React나 저장소에 의존하지 않으며 모듈을 import하는 것만으로 요청하지 않습니다. 화면의 조회·CRUD 버튼은 [공통 상태 계층](../../state/README.md)을 통해 연결됩니다.

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

취소가 필요 없으면 `await getLedger()`로 조회합니다. `createApiClient({ timeoutMs, fetchImpl })`로 대기 시간과 테스트용 fetch를 주입할 수 있습니다. 공통 클라이언트는 선행 `/`가 있는 동일 출처 상대 경로만 허용합니다. 절대 URL·`//`·공백·역슬래시·fragment는 설정 오류입니다. `get`·`post`·`patch`·`delete` 모두 같은 요청·타임아웃·취소 경로를 사용합니다.

기본 대기 시간은 **10,000ms**이며 요청 시작부터 헤더와 본문 수신 완료까지 같은 타이머를 유지합니다. 타임아웃 또는 외부 `AbortSignal`은 내부 fetch 신호를 중단합니다. fetch가 취소를 무시해도 반환 Promise는 종료되고 뒤늦게 도착한 데이터를 검증하지 않습니다. 완료 시 타이머·외부 신호 리스너를 정리하며 동시 요청의 취소는 서로 독립적입니다. 자동 재시도는 없습니다.

| `ApiError.code` | 의미 | `status` |
| --- | --- | --- |
| `HTTP` | 2xx가 아닌 HTTP 응답 | HTTP 상태 |
| `NETWORK` | 연결 실패 또는 본문 수신 실패. 브라우저에서는 CORS 실패도 포함될 수 있음 | 없음 |
| `TIMEOUT` | 설정된 대기 시간 초과 | 없음 |
| `INVALID_RESPONSE` | JSON이 필요한데 204/205, 잘못된 JSON 또는 도메인 검증 실패 | HTTP 상태 |
| `CONFIGURATION` | 잘못된 상대 경로 또는 대기 시간(정수 1–2,147,483,647ms) | 없음 |
| `INVALID_REQUEST` | 입력 필드·값·ID 또는 JSON 직렬화 실패, 전송 전 거부 | 없음 |
| `ABORTED` | 호출자가 취소한 요청 | 없음 |

GET과 거래·카테고리 CRUD 모두 `credentials: 'same-origin'`을 사용하여 동일 출처 요청에 브라우저가 관리하는 HttpOnly 세션 쿠키를 사용할 수 있도록 합니다. 사용자명·비밀번호·인증 헤더는 앱 코드나 환경변수에 저장하거나 직접 구성하지 않습니다. `cache: 'no-store'`로 브라우저 HTTP 캐시를 사용하지 않습니다. 기존 Service Worker 설정은 변경하지 않았으며 API 응답 캐시·오프라인 저장은 없습니다.

## 쓰기 함수와 계약

각 함수의 마지막 인수는 `(client = apiClient, options?: { signal })`입니다. 생성·수정에는 JSON 본문과 `Content-Type: application/json`을 보내고, 삭제에는 본문·Content-Type을 보내지 않습니다.

| 함수 | HTTP 경로 | 입력 | 성공 |
| --- | --- | --- | --- |
| `createTransaction(input, client?, options?)` | POST `/api/v1/transactions` | `date`, `type`, `amount`, `categoryId`, `memo` 전체 | 201, 서버 ID가 있는 `Transaction` |
| `updateTransaction(id, input, client?, options?)` | PATCH `/api/v1/transactions/:id` | 위 필드 중 하나 이상 | 200, 최종 `Transaction` |
| `deleteTransaction(id, client?, options?)` | DELETE `/api/v1/transactions/:id` | 문자열 ID | 204, `void` |
| `createCategory(input, client?, options?)` | POST `/api/v1/categories` | `name`, `type`, `symbol` | 201, 서버 ID가 있는 `Category` |
| `updateCategory(id, input, client?, options?)` | PATCH `/api/v1/categories/:id` | `name`만 | 200, 최종 `Category` |
| `deleteCategory(id, client?, options?)` | DELETE `/api/v1/categories/:id` | 문자열 ID | 204, `void` |

허용하지 않은 필드·생성 ID·빈 PATCH를 거부하고 이름·메모를 trim합니다. 날짜·정수 금액·열거 값·길이·문자열 ID(1–191자)를 전송 전에 검사합니다. ID는 단일 URL 세그먼트로 인코딩하며 `.`·`..`와 인코딩 불가 ID는 거부합니다. 생성·수정 응답은 기존 도메인 단건 검증기를 사용하고 수정 응답 ID가 대상과 다르면 `INVALID_RESPONSE`입니다. 생성 201·수정 200·삭제 204 외 성공 상태도 최종 처리 결과로 간주하지 않습니다. 삭제 204에서는 JSON 파싱을 하지 않습니다.

저수준 API 함수는 실패 시 `ApiError`를 던집니다. 화면에서는 [공통 상태 계층의 같은 이름의 6개 작업](../../state/README.md)을 사용해야 전체 Ledger 검증·중복 차단·불확실 결과 처리가 함께 적용됩니다. 전송된 쓰기의 취소는 서버 롤백을 보장하지 않으므로, 상태 계층은 이를 재조회가 필요한 결과로 분류합니다. 자동 쓰기 재시도는 없습니다.

## 개발과 배포 경로

`npm run dev`에서는 브라우저의 `/api/v1/ledger` 요청을 Vite가 `http://127.0.0.1:13004/api/v1/ledger`로 전달합니다. 운영 API를 개발 프록시로 사용하지 않습니다. `/api`를 제거하지 않으며 `changeOrigin: true`, TLS 인증서 검증(`secure: true`)을 사용합니다. 브라우저는 개발 서버의 동일 출처로 요청하므로 백엔드의 브라우저 CORS 허용 설정을 전제로 하지 않습니다.

**개발 프록시는 `dist/`에 포함되지 않습니다.** 실제 배포에서는 웹앱과 같은 HTTPS 출처의 `/api`를 기존 백엔드로 전달하는 배포 호스트의 reverse proxy가 별도로 필요합니다. `/api`에 SPA HTML을 반환하면 `INVALID_RESPONSE`가 발생합니다. 별도 출처의 API를 브라우저에서 직접 부르도록 바꾸면 HTTPS·CORS 조건을 따로 검토해야 합니다. 이번 작업에서는 운영 서버·DB·Nginx 설정을 바꾸지 않았습니다.

Vite preview는 기본적으로 `server.proxy`를 상속하므로, 혼동을 막기 위해 `preview.proxy: {}`를 명시했습니다. `npm run preview`는 정적 앱/PWA 확인용이고 API 프록시는 제공하지 않습니다. 개발/preview 서버는 실제 배포 서버가 아닙니다. 참고: [Vite server.proxy](https://vite.dev/config/server-options#server-proxy), [preview.proxy](https://vite.dev/config/preview-options#preview-proxy).

배포 시 Nginx HTTP Basic Authentication으로 웹앱과 동일 출처 `/api/`를 보호하는 구성을 전제로 합니다. 인증 입력과 인증 정보 관리는 브라우저에 맡기며 앱 자체 로그인 화면·인증 상태 관리는 추가하지 않습니다. `same-origin` 설정만으로 서버 인증이나 사용자별 데이터 분리가 구현되지는 않습니다. 실제 Nginx 적용과 HTTPS 배포 후 브라우저 인증·API 접근 확인은 서버 배포 단계에서 별도로 진행해야 합니다. 이번 변경에서는 서버·Nginx·DB를 수정하지 않았습니다.

## 검증과 다음 단계

`npm run typecheck`, `npm test`, `npm run build`로 검사합니다. `tests/api.test.ts`의 모의 fetch·HTTP Response 및 가상 타이머는 정상/빈 Ledger, 오류 분류, 본문 수신 타임아웃, 호출자 취소, 동시 요청과 정리를 검사합니다. 단위 테스트는 실제 네트워크를 사용하지 않습니다. 기존 도메인 테스트 104개와 새 API 테스트 59개, 총 163개가 통과했습니다.

2026-11-16 개발 서버의 앱 HTTP 200과 Vite 프록시를 통한 읽기 전용 `GET /api/v1/ledger` HTTP 200 및 웹 도메인 검증 통과를 확인했습니다. 실제 응답은 메모리에서만 검증했으며 거래 내용은 로그·파일·문서에 기록하지 않았습니다. 브라우저 화면 연결·실제 배포 출처의 라우팅·실제 iPhone 네트워크 동작은 이번 검증에 포함하지 않습니다.

현재 조회 상태(`loading`·`ready`·`error`·`refreshing`)와 쓰기 상태(`saving`·`needsRefresh`)는 [React 상태 계층](../../state/README.md)에 구현했습니다. 기존 조회·도메인·화면 테스트 185개에 쓰기 API·상태 테스트 214개를 더해 총 399개가 통과했습니다. 모든 HTTP 테스트는 주입된 모의 fetch·Response·가상 타이머를 사용하며 운영 서버에 POST·PATCH·DELETE를 보내지 않습니다. 이 수치는 API·상태 계층의 Node 테스트이며, 이후 연결한 UI의 브라우저 검증은 [별도 절차](../../../tests/browser/README.md)로 실행합니다. PWA 설정과 기존 API·조회 계약을 유지하며 로컬 저장은 구현하지 않습니다.


## 인증 클라이언트

`authApi.ts`는 로그인 200·세션 조회 200·로그아웃 204를 처리합니다. 기존 CRUD 생성의 기본 201 계약은 유지합니다. 서버 쿠키는 JS에서 읽지 않으며 CSRF 토큰만 메모리에 보관해 쓰기 요청의 `X-CSRF-Token`에 추가합니다. 금융 API 401은 인증 상태를 해제하고 이전 장부를 언마운트합니다. 늦은 이전 요청의 401이 새로운 로그인 상태를 덮어쓰지 않게 요청 당시의 CSRF 값으로 구분합니다. 로그인과 로그아웃은 자동 재시도하지 않습니다.

실제 인증은 HTTPS 전용입니다. 기본 Vite HTTP 서버는 기존 모의 CRUD UI 테스트에 사용할 수 있고, 실제 쿠키·로그인 검증은 격리 HTTPS 프록시를 사용해야 합니다.
