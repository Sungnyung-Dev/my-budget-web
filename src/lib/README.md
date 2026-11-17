# 공통 유틸리티와 외부 연결

- `dates.ts`: 화면에서 사용하는 월 이동·달력 유틸리티입니다.
- `api/client.ts`: 상대 경로 GET·POST·PATCH·DELETE, 오류 분류, 기본 10초 타임아웃 및 호출자 취소를 제공하는 공통 HTTP 클라이언트입니다.
- `api/ledgerApi.ts`: `GET /api/v1/ledger` 결과를 기존 도메인 검증기로 검사합니다. 사용법과 개발/배포 프록시 차이는 [API 문서](api/README.md)를 참고합니다.
- `api/transactionApi.ts`·`api/categoryApi.ts`: 생성·수정·삭제 6개 함수와 입력/응답 검증입니다.
- 조회·쓰기·취소·재조회와 불확실 결과 처리는 [상태 계층](../state/README.md)에서 관리합니다. 조회와 기존 입력 시트의 저장·수정·삭제 버튼은 이 상태 계층을 통해 연결합니다. 브라우저 거래 저장·API 응답 캐시는 구현하지 않습니다.
