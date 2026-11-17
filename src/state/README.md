# 서버 Ledger 상태와 화면 연결

`App`에서 한 번 호출하는 `useLedger()`가 `ledgerStore.ts`를 소유합니다. React 기본 `useSyncExternalStore`로 상태를 구독하고, 조회한 데이터를 각 화면의 props로 전달합니다. 추가 상태 관리 라이브러리·전역 데이터 캐시·Provider 중첩은 없습니다.

```text
App 마운트 / 수동 재조회
  → getLedger(apiClient, { signal })
  → GET /api/v1/ledger (개발 시 Vite HTTPS 프록시)
  → API JSON·도메인 검증
  → 상태 계층의 validateLedger 확인
  → ledgerViews / domain selectors
  → 홈·내역·통계·설정 props
```

| 상태 | 데이터 | 화면 |
| --- | --- | --- |
| `loading` | `null` | 최초 조회 안내. 금액·거래 화면을 만들지 않음 |
| `error` | `null` | 최초 실패 안내와 **다시 시도** |
| `ready` | 검증된 Ledger | 실제 값. 재조회 실패 시 마지막 정상 Ledger와 오류 안내 |
| `refreshing` | 마지막 정상 Ledger | 기존 화면과 조회 중 안내. 설정의 중복 새로고침 비활성화 |

`reload()`는 성공 여부를 반환합니다. 진행 중 호출은 같은 Promise를 공유하고, 탭·기간·날짜 변경은 GET을 추가하지 않습니다. 실패 시 자동 재시도하지 않습니다. 정상 빈 거래 배열은 `ready`이고 계산값은 0입니다. 로딩·실패를 빈 Ledger로 치환하지 않습니다. 오류 원문이나 실제 거래 내용을 기록하지 않습니다.

마운트 effect는 초기 GET을 예약하고 해제 시 AbortController로 취소합니다. StrictMode의 즉시 effect 재실행은 예약된 이전 작업을 무효화하므로 최초 GET을 중복 전송하지 않습니다. 각 응답은 현재 요청의 controller인지 확인합니다. 취소를 무시하는 로더의 늦은 성공·실패와 이전 요청의 `finally`도 새 요청·상태를 바꾸지 못합니다. 구독 해제 뒤에는 알림을 보내지 않습니다. 설계 참고: [React 외부 저장소 구독](https://react.dev/reference/react/useSyncExternalStore), [StrictMode effect 재실행](https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-re-running-effects-in-development).

`src/app/ledgerViews.ts`는 기존 도메인 함수를 재사용하는 화면 데이터 어댑터입니다. 월별 합계·최근 3건·카테고리 비율·소비 지표, 연간 합계·12개월 값, 전체 거래 기준 카테고리 사용 건수를 제공합니다. 기록된 월 평균은 수입만 있는 월도 포함하며 큰 정수의 반올림은 BigInt로 계산합니다. 화면용 `Date`는 현지 연·월에서 `YYYY-MM-DD` 키로 변환합니다.

홈·내역의 거래 행은 수정 시트를 열고 내역의 +는 선택 날짜의 생성 시트를 엽니다. 설정의 카테고리 관리도 동일 상태의 추가·이름 변경·삭제 작업을 사용합니다. 각 입력 시트에 `LedgerController`를 전달하며 화면별 store나 별도 API 호출을 만들지 않습니다. 인증·자동 재시도·로컬/오프라인 저장은 없습니다. 새로고침 시 서버를 다시 조회하고 기존 선택 상태는 영구 저장하지 않습니다.

## 쓰기 상태와 결과

`LedgerState`에 `saving`·`needsRefresh`를 추가했습니다. `useLedger()`와 store는 API와 같은 `createTransaction`·`updateTransaction`·`deleteTransaction`·`createCategory`·`updateCategory`·`deleteCategory`를 제공합니다. 인수는 API의 입력/대상 ID와 같고 공유 client·취소 신호는 store가 관리합니다. 테스트에서는 `createLedgerStore(undefined, mockClient)`로 모의 클라이언트를 주입합니다. 기존 조회 로더 주입도 유지합니다.

1. 초기 조회 전·해제 뒤의 쓰기는 `NOT_READY`입니다. GET 또는 쓰기가 진행 중이면 새 쓰기는 `BUSY`이며 전송하지 않습니다. 쓰기 중 `reload()`는 `false`를 반환하고 GET을 보내거나 예약하지 않습니다.
2. 필드 정규화와 기존 도메인 입력 검증으로 카테고리 존재·유형, 수정 대상, 사용 중 카테고리 삭제, 이름 중복, 변경 후 금액 합계를 요청 전에 확인합니다. 부분 수정은 기존 거래와 합쳐 검증하되 제공한 필드만 전송합니다.
3. `saving: true` 동안 Ledger는 변경하지 않습니다. 성공 응답의 서버 ID·최종 객체로 다음 전체 Ledger를 구성하고 `validateLedger` 통과 뒤에만 반영합니다. 삭제는 204 성공 뒤 대상만 제외합니다. 수정 ID 불일치, 카테고리 고정 type/symbol 변경, 생성 ID 중복, 참조·유형·전체 합계 오류도 적용하지 않습니다.
4. 명확한 HTTP 4xx 거절(408 제외) 또는 전송 전 설정/입력 오류는 마지막 Ledger를 유지하고 `saving`만 해제합니다. 네트워크·타임아웃·HTTP 5xx/408·잘못된 성공 응답·전송 후 취소는 결과가 불확실하므로 `needsRefresh: true`로 설정합니다. 이후 쓰기는 `NEEDS_REFRESH`로 차단하며 자동 재시도하지 않습니다.
5. GET 재조회 중·실패 후에는 기존 데이터와 차단 상태를 유지합니다. 검증된 GET 성공 후 서버 Ledger를 반영하고 `needsRefresh`와 조회 오류를 해제합니다. 이미 전송한 쓰기가 마운트 해제로 취소되면 불확실 상태를 유지하며, 이전 요청의 늦은 응답·finally가 새 조회를 덮어쓰지 못하게 합니다. 전송 예약만 된 상태의 취소는 쓰기를 보내지 않습니다.

쓰기는 예외 대신 다음 `WriteResult<T>`를 반환합니다. 조회용 `state.error`와 별도로 호출자가 폼 오류를 표시할 수 있으며 상태 계층은 입력값·시트 열림·삭제 확인 상태를 변경하지 않습니다.

```ts
// 성공: { ok: true, value: 서버의 Transaction/Category 또는 삭제의 undefined }
// 실패: { ok: false, code, message, status?, needsRefresh }
const result = await createTransaction(input)
if (result.ok) {
  // 성공을 확인한 뒤 입력 시트를 닫습니다.
} else {
  // 입력값과 삭제 확인 화면을 유지하고 result.message를 표시합니다.
  // result.needsRefresh이면 쓰기를 차단한 채 사용자가 GET 재조회하도록 안내합니다.
}
```

실패 코드는 `INVALID_REQUEST`·`HTTP`·`CONFIGURATION`·전송 전 `ABORTED`, `NOT_READY`·`BUSY`·`NEEDS_REFRESH`·`UNCERTAIN`입니다. 불확실한 오류는 원문 대신 안전한 재조회 안내를 반환합니다. 성공한 GET 뒤에도 시트의 입력값·삭제 확인을 유지하며, 사용자가 서버 목록에서 결과를 확인하도록 안내합니다. 같은 쓰기를 자동으로 재실행하지 않습니다.

## 검증

- `npm run typecheck`, `npm test`, `npm run build`: 통과. 기존 도메인·조회·화면 어댑터 185개와 새 CRUD API·상태 테스트 214개, API·상태 연결 당시 총 399개이며 이후 표시 포맷 테스트 8개를 추가해 현재 총 407개입니다. HTTP 테스트는 모두 모의 응답을 사용합니다. 새 테스트는 6개 쓰기, ID/응답 검증, 204, 입력 차단, 중복/경합, 불확실 결과 후 GET 실패·검증 실패·성공, 해제/취소/늦은 응답을 검증합니다.
- 2026-11-16 Chrome에서 테스트 전용 모의 HTTP 응답으로 최초 실패·재시도·로딩, 정상 빈 Ledger와 카테고리만 있는 Ledger, 월간·연간 합계·차트·카테고리 사용 건수, 시트의 비활성 저장/삭제, 재조회 실패 후 기존 데이터 유지, 조회 중 탭 전환·중복 GET 방지를 확인했습니다.
- 320×568·390×844·430×932·768×1024·1280×800에서 화면 연결 시나리오를 통과했습니다. 모바일 하단 탭·PC 사이드바와 2열 배치를 유지하며, 430/768/1280px에서는 각 탭의 본문 가로 넘침도 검사했습니다. 검증용 HTML·스크립트는 제거했고 테스트용 거래는 프로덕션 코드에 포함하지 않습니다.
- 실제 개발 프록시의 최초 GET 뒤 홈 화면이 정상 표시되는 것을 확인했습니다. 운영 데이터 내용은 기록하지 않았으며 쓰기 요청은 하지 않았습니다.
- 기존 Vite PWA 설정·아이콘을 유지하며 정적 앱 precache 10개를 생성합니다. 변경된 JS/CSS의 SW 해시는 빌드가 갱신합니다. 실제 iPhone 설치·Safari·Safe Area·배포 출처의 `/api` 라우팅은 별도 확인이 필요합니다.

## UI 연결

- `useWriteAction.ts`: 공통 store의 `WriteResult`를 표시하는 시트별 훅입니다. 동기 ref로 연속 submit을 막고 성공 시에만 닫습니다. 실패 시 입력·확인 상태에는 손대지 않으며 해제 뒤의 결과는 UI에 적용하지 않습니다.
- `WriteStatus.tsx`: 안전한 거절 메시지, `needsRefresh`와 수동 GET, 재조회 중 안내, 성공 뒤 목록 확인 안내를 공유합니다. 불확실 오류가 난 시트를 닫아도 `LedgerStatus`에 전체 쓰기 차단과 GET 진입이 남습니다.
- `BottomSheet`: `saving` 또는 `refreshing` 중 fieldset과 닫기를 비활성화하고 Escape·배경 클릭도 차단합니다. 입력값은 로컬 state이므로 GET 성공으로 덮어쓰지 않습니다. 삭제 확인 중에는 저장을 비활성화하고 Enter 저장도 차단합니다.
- 재조회 후 없어진 수정 대상을 확인하고 저장·삭제를 비활성화합니다. 카테고리 사용 건수·삭제 가능 여부는 오래된 editor target이 아닌 최신 Ledger에서 계산합니다.
- API와 store의 검증·HTTP·잠금·불확실 결과 처리는 재구현하지 않았습니다. 카테고리 UI도 기존 `validateCategoryName`, 거래 금액도 `parseAmount`를 재사용합니다.

현재 UI 검증은 [브라우저 테스트](../../tests/browser/README.md)에 정리했습니다. 실제 서버 쓰기 검증과 iPhone Safari 실기기 확인은 사용자가 별도로 수행합니다. PWA 설정·기존 API/store·집계·입력 검증·iOS·백엔드는 유지합니다. 숫자 표시·FAB·PC 헤더의 UI 4건은 반영했으며 표시 포맷만 변경했습니다. 인증·배포와 실기기 확인은 다음 범위입니다.
