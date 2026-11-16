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

거래 목록은 읽기 전용입니다. 입력 시트에는 서버 카테고리를 전달하지만 저장·삭제 버튼은 항상 비활성화합니다. POST·PATCH·DELETE, 인증, 자동 재시도, 로컬/오프라인 저장은 없습니다. 새로고침 시 항상 서버를 다시 조회하고 기존 선택 상태는 영구 저장하지 않습니다.

## 검증

- `npm run typecheck`, `npm test`, `npm run build`: 통과. 도메인 104개·API 59개·조회 상태 17개·화면 데이터 어댑터 5개, 총 185개 테스트입니다. HTTP 테스트는 모두 모의 응답을 사용합니다.
- 2026-11-16 Chrome에서 테스트 전용 모의 HTTP 응답으로 최초 실패·재시도·로딩, 정상 빈 Ledger와 카테고리만 있는 Ledger, 월간·연간 합계·차트·카테고리 사용 건수, 시트의 비활성 저장/삭제, 재조회 실패 후 기존 데이터 유지, 조회 중 탭 전환·중복 GET 방지를 확인했습니다.
- 320×568·390×844·430×932·768×1024·1280×800에서 화면 연결 시나리오를 통과했습니다. 모바일 하단 탭·PC 사이드바와 2열 배치를 유지하며, 430/768/1280px에서는 각 탭의 본문 가로 넘침도 검사했습니다. 검증용 HTML·스크립트는 제거했고 테스트용 거래는 프로덕션 코드에 포함하지 않습니다.
- 실제 개발 프록시의 최초 GET 뒤 홈 화면이 정상 표시되는 것을 확인했습니다. 운영 데이터 내용은 기록하지 않았으며 쓰기 요청은 하지 않았습니다.
- 기존 Vite PWA 설정·아이콘을 유지하며 정적 앱 precache 10개를 생성합니다. 변경된 JS/CSS의 SW 해시는 빌드가 갱신합니다. 실제 iPhone 설치·Safari·Safe Area·배포 출처의 `/api` 라우팅은 별도 확인이 필요합니다.

다음 CRUD 단계에서는 쓰기 API와 입력 검증을 연결하기 전에 진행 중 중복 저장, 서버 확정 결과 반영, 실패 시 기존 데이터 유지 및 결과가 불확실한 요청의 재조회 정책을 정해야 합니다. 그 후 거래·카테고리 저장/삭제를 개별적으로 연결하고 버튼을 활성화합니다. 운영 데이터 쓰기 테스트와 인증/접근 제어 변경은 별도 범위입니다.
