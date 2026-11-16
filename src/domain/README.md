# 가계부 도메인

인접한 `my-budget-ios/src/domain/{types,dates,ledger,selectors,validateLedger}.ts`와 `__tests__/ledger.test.ts`의 계산·입력·검증 규칙을 이식했습니다. iOS의 API 모듈에서도 동일한 타입과 응답 검증기를 사용하는 것을 확인했습니다. React, React Native, AsyncStorage, 네트워크, 브라우저 저장소 의존성은 없습니다.

| 파일 | 제공 기능 |
| --- | --- |
| `types.ts` | iOS와 같은 `TransactionType`, `CategorySymbol`, `Category`, `Transaction`, `TransactionInput`, `LedgerData`, `Totals` |
| `dates.ts` | `dateKey`, `dateParts`, `todayKey`, `daysInMonth`, `weekday`, `shiftMonth`, `isValidDate`, `pad` |
| `ledger.ts` | `MAX_AMOUNT`, `parseAmount`, 안전한 정수 합계 `sumAmounts` |
| `selectors.ts` | `getTotals`, `forMonth`, `forYear`, `forDay`, `recentTransactions`, `categorySpending`, `spendingMetrics`, `yearlyMonths` |
| `validateLedger.ts` | 거래·카테고리 단건/목록 및 전체 Ledger 검증, 입력 검증, 사용 중 카테고리 삭제 차단 검증 |
| `formatters.ts` | 화면 표시 전용 `formatMoney`, `signedMoney`, `dateLabel` |

## 데이터 계약과 사용 순서

- `LedgerData`는 `{ version: 1, categories: Category[], transactions: Transaction[] }`입니다. 거래는 `{ id, date, type, amount, categoryId, memo }`, 카테고리는 `{ id, name, type, symbol }` 구조를 유지합니다.
- 외부 응답은 `validateLedger(unknown)`로 먼저 검증한 뒤 selectors에 전달합니다. 정상적인 빈 배열의 합계와 소비 평균은 0이며, 데이터 누락·형식 오류를 빈 데이터로 바꾸지는 않습니다. 단건/목록 검증은 해당 객체의 필드·중복·금액 한도를 검사하고, 카테고리 존재와 유형 참조는 전체 Ledger에서 검사합니다.
- 날짜는 실제 존재하는 1900–9999년의 `YYYY-MM-DD`입니다. 날짜 조회·이동 함수에는 검증된 날짜와 유효한 연도·월을 전달합니다. `shiftMonth`는 현지 달력 기준으로 윤년과 월말을 조정하며 UTC 문자열 변환을 사용하지 않습니다. `todayKey`는 기준 `Date`를 주입할 수 있습니다.
- 금액은 1–999,999,999,999원의 정수입니다. `parseAmount`는 올바른 천 단위 쉼표와 앞뒤 공백을 허용하고 소수·지수·음수·잘못된 쉼표를 거부합니다. 전체 거래 합계는 `Number.MAX_SAFE_INTEGER` 이하여야 합니다.
- 선택일 조회와 최근 거래 정렬은 날짜 내림차순이며, 같은 날짜는 iOS처럼 입력 배열의 뒤쪽 거래가 먼저 나옵니다. ID를 생성 시각으로 해석하지 않습니다. 조회·정렬·집계는 입력 배열이나 객체를 변경하지 않습니다.
- `categorySpending`은 지출액이 있는 지출 카테고리만 금액 내림차순으로 반환합니다. `ratio`는 0–1 비율이며 표시용 백분율은 만들지 않습니다. `spendingMetrics`는 지출 건수·지출일 수·지출일 평균(원 단위 반올림)을 반환합니다.
- `yearlyMonths`는 항상 1–12월의 `{ month, count, income, expense, balance }` 12개를 반환합니다. 빈 달의 값은 모두 0이고 `count`는 수입과 지출을 합친 거래 건수입니다. 현재 `YearChart`가 요구하는 숫자 필드와 호환됩니다. 카테고리 집계 결과는 `{ category, amount, ratio }`로 iOS 구조를 유지합니다.

## 입력 검증

- `validateTransactionInput(data, input, id?)`: 금액·날짜·유형별 카테고리·메모·수정 대상·전체 합계 한도를 검사하고 메모를 trim한 입력을 반환합니다. 수정 검증에서는 대상의 이전 금액을 합계에서 제외합니다.
- `validateCategoryName(data, type, rawName, id?)`: trim 후 1–20자, 같은 유형의 대소문자 무시 중복, 수정 대상의 ID·유형을 검사하고 이름을 반환합니다.
- `assertCategoryUnused(data, id)`: 거래에서 참조 중이면 오류를 던집니다.
- 이 함수들은 iOS `saveTransaction`·`saveCategory`·`deleteCategory`의 검증 부분만 분리한 것입니다. ID 생성, 실제 추가·수정·삭제, 저장 및 API 호출은 구현하지 않습니다. 응답 검증은 iOS처럼 객체 값을 정규화하지 않고 검증만 합니다.

## 이식 시 조정과 검증

금액·날짜 표시 함수는 통계 모듈에서 `formatters.ts`로 분리했습니다. iOS 화면에 있던 선택일 필터와 정렬은 `forDay`로 묶었습니다. 안전한 정수 범위 초과를 집계에서도 차단하고, 큰 금액을 나눌 때 발생할 수 있는 부동소수점 반올림 오차는 일평균 계산 내부의 `BigInt` 정수 연산으로 방지합니다. 반환 금액은 모두 API와 호환되는 `number`입니다. 비율만 소수로 반환합니다.

추가 라이브러리 없이 Node의 기본 테스트 러너를 사용합니다. `npm test`는 날짜·집계·검증 테스트 104개를 실행하며 테스트와 도메인은 `npm run typecheck`에 포함됩니다. 테스트용 거래와 카테고리는 `tests/` 안에만 있습니다. UTC와 America/Los_Angeles에서도 동일하게 통과했고, Node 24의 도메인 커버리지는 실행 코드의 줄·분기·함수 모두 100%입니다.

현재 화면은 새 도메인을 아직 사용하지 않습니다. 기존 `src/lib/dates.ts`는 화면용 `Date` 인터페이스를 유지하며, API 연결 시 필요한 어댑터를 검토합니다. 보류 중인 쉼표·0 표시·FAB 배경·PC 헤더 요청은 이번 이식에서 다루지 않았습니다.
