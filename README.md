# 나의 가계부 · Web

기존 React Native iOS 가계부를 웹으로 옮기기 위한 React + TypeScript + Vite 기반입니다. 반응형 PWA 기반과 원본 시안에 맞춘 내역 화면을 구현했습니다. 실제 데이터 연동은 아직 없습니다.

## 실행과 검사

Node.js 22.12 이상(검증 환경: Node.js 24)과 npm을 사용합니다.

```bash
npm ci
npm run dev
```

터미널에 표시되는 로컬 주소를 엽니다. 기본 주소는 `http://localhost:5173`입니다.

```bash
npm run typecheck
npm run build
npm run preview
```

`build`는 TypeScript 검사 후 `dist/`에 정적 앱, `manifest.webmanifest`, `sw.js`, Workbox 파일을 생성합니다. `preview`의 기본 주소는 `http://localhost:4173`입니다.

초기 검증에서 개발 서버 HTTP 응답, TypeScript 검사, 프로덕션 빌드, PC·320/390/430px 화면, 탭·기간·날짜 선택을 확인했습니다. Chrome에서 Worker 활성화, 정적 리소스 10개 저장, 오프라인 새로고침도 확인했습니다. 실제 iPhone Safari 설치는 아직 검증하지 않았습니다.

## 현재 화면

| 화면 | 기본 구성 |
| --- | --- |
| 홈 | 월 이동, 지출·수입·건수 요약 자리, 카테고리별 지출·최근 거래 빈 상태 |
| 내역 | 원본 스타일의 월 이동·요약 카드·달력, 선택일의 빈 목록, 플로팅 + 버튼과 준비 안내 |
| 통계 | 월간·연간 전환, 기간 이동, 차트·소비 정보 자리 |
| 설정 | 기본 표시 형식, 연결 전·준비 중 상태, iPhone 홈 화면 설치 안내 |

내역 화면은 거래가 없는 UI 상태로 금액 `0`·거래 `0건`을 표시합니다. 이는 조회한 서버 잔액이 아닙니다. 다른 화면의 금액·건수 자리는 기존처럼 `—`로 표시합니다. 거래·카테고리 CRUD, API 요청, 데모 데이터, 거래 로컬 저장은 없습니다. 화면 상태는 React `useState`로만 관리하며 새로고침하면 홈에서 시작합니다. 선택한 월·날짜는 탭을 오가도 유지됩니다.

- **320–599px:** 단일 열과 고정 하단 탭(홈·내역·통계·설정).
- **600–1023px:** 내역은 최대 580px의 단일 열과 하단 탭을 유지합니다. 다른 화면의 기존 반응형 배치는 유지합니다.
- **1024px 이상:** 고정된 위치의 사이드바와 두 열 콘텐츠.
- `viewport-fit=cover`, `env(safe-area-inset-*)`, 동적 뷰포트 높이를 사용합니다. 내역은 FAB 위에서 끝나는 별도 스크롤 영역을 사용해 내용이 버튼과 하단 탭에 가려지지 않도록 합니다. 다른 화면은 기존 문서 스크롤을 유지합니다.
- 기본 키보드 탐색, 현재 메뉴 표시, 본문 건너뛰기, 날짜 선택 상태를 제공합니다.

### 내역 화면의 원본 재현

`references/ios_ledger_final_ui.html`을 디자인 기준으로, 인접한 iOS 프로젝트를 구현 참고로 사용했습니다. `MY LEDGER`, 29px 제목, 22px 좌우 여백, 31px 월 이동 버튼, 연회색 3칸 요약, 29px 원형 날짜 선택, 45px 달력 행, 점선 빈 목록, 21px 하단 탭 아이콘, 45px 검정 FAB를 맞췄습니다. 월 이동 버튼의 터치 영역은 44px입니다.

390px의 동일 너비 비교에서 헤더·월 이동·요약·달력·구분선·빈 목록의 위치와 크기가 원본과 일치했습니다. 검증용 복사본에서만 가짜 프레임·상태바와 샘플 거래를 제외했고 원본 파일은 변경하지 않았습니다. 앱은 React 컴포넌트와 CSS로 구현했으며 원본 HTML을 불러오거나 삽입하지 않습니다.

원본과의 의도적인 차이는 거래 추가 안내 문구, FAB 위에서 끝나는 스크롤 영역, 태블릿의 폭 제한, PC의 사이드바·2열 배치입니다. + 버튼은 준비 안내만 열며 거래 입력·저장 기능은 없습니다. 실제 iPhone Safari의 글꼴 렌더링과 Safe Area는 실기기 확인이 남아 있습니다.

브라우저 검증: **320×568 / 390×844 / 430×932 / 768×1024 / 1280×800 / 1440×800**. 모든 크기에서 가로 넘침이 없고, 스크롤 영역과 FAB 사이 16px·FAB와 하단 탭 사이 13px 간격을 확인했습니다. 날짜 선택, 연도 경계 이동, 31일에서 2월 말일로의 조정, 탭 간 선택 상태 유지, + 버튼 안내와 닫기도 확인했습니다.

## PWA

`vite-plugin-pwa`의 `generateSW`를 사용합니다. 앱 이름·한국어·standalone 실행·시작 URL·범위와 192/512px PNG, maskable PNG, 180px Apple touch icon을 구성했습니다. 아이콘은 자체 제작한 흑백 장부 모양이며 `public/favicon.svg`에 벡터 원본이 있습니다.

- **캐시 범위:** 빌드된 JS/CSS/HTML/폰트, 명시한 아이콘과 Manifest만 precache합니다.
- `runtimeCaching`은 빈 배열입니다. API 응답, 거래 데이터, 외부 요청을 캐시하는 규칙이나 백그라운드 동기화는 없습니다.
- 문서 요청의 앱 화면 대체는 `/`, `/index.html` 및 해당 쿼리 문자열에만 적용됩니다. `/api` 경로는 제외합니다.
- 새 Worker는 사용자에게 업데이트 알림을 표시합니다. 사용자가 **새로고침**을 선택할 때 활성화합니다.
- 개발 중 캐시 간섭을 줄이기 위해 **개발 서버에서는 Service Worker를 등록하지 않습니다.** PWA 검증에는 `build` 후 `preview`를 사용합니다.
- 첫 온라인 방문 후에는 앱 화면을 오프라인에서 열 수 있습니다. 오프라인 거래 저장·수정 기능은 없습니다.

### 설치와 확인

실제 iPhone 설치와 Service Worker 실행은 HTTPS 배포 후 확인합니다. 개발 PC에서는 `localhost` 또는 `127.0.0.1`로 검증할 수 있습니다. iPhone에서 PC의 일반 HTTP LAN 주소로 접근하는 것만으로는 PWA 검증을 완료할 수 없습니다.

1. `npm run build` → `npm run preview` 후 브라우저에서 열고 한 번 새로고침합니다.
2. Chrome DevTools **Application → Manifest**에서 이름·아이콘·standalone 설정을 확인합니다.
3. **Service workers**에서 `sw.js`의 활성화를, **Cache storage**에서 정적 앱 파일만 저장되는지 확인합니다.
4. DevTools **Network → Offline** 후 새로고침하여 앱 화면이 열리는지 확인하고 다시 온라인으로 복구합니다.
5. iPhone에서는 HTTPS 주소를 Safari로 열어 **공유 → 홈 화면에 추가**로 설치하고, 독립 실행·아이콘·Safe Area·스크롤을 확인합니다.

설정 참고: [Vite PWA 공식 문서](https://vite-pwa-org.netlify.app/guide/), [업데이트 알림](https://vite-pwa-org.netlify.app/guide/prompt-for-update), [Workbox 캐시 설정](https://vite-pwa-org.netlify.app/workbox/generate-sw).

## 폴더 구조

```text
public/
  favicon.svg          # 앱 아이콘 벡터 원본
  icons/               # PWA / Apple touch PNG
src/
  app/navigation.ts    # 메뉴와 페이지 타입
  components/          # 공통 레이아웃·기간 선택·빈 상태·PWA 알림
  pages/               # 홈·내역·통계·설정, 내역 전용 HistoryPage.css
  domain/              # 향후 거래·카테고리 타입과 순수 통계 로직
  lib/                 # 날짜 유틸리티, 향후 api/ 클라이언트
  App.tsx              # 페이지·선택 월 상태
  App.css              # 화면과 반응형 레이아웃
  index.css            # 공통 스타일·디자인 토큰
vite.config.ts         # Vite / Manifest / Service Worker 설정
```

라우터, UI 라이브러리, 별도 상태 관리 도구는 추가하지 않았습니다. 원본 HTML과 `my-budget-ios`는 읽기 전용으로 참고했습니다. 홈·통계·설정 화면의 컴포넌트와 기존 PWA 설정·업데이트 로직은 유지했습니다.

## 다음 구현 순서

1. 홈·통계·설정 화면과 거래 입력 UI를 원본 기준으로 순차 재현.
2. iOS의 도메인 타입·날짜·통계 함수 검토 및 웹용 순수 로직 이식.
3. 기존 `https://budget-api.ecoma.kro.kr`의 계약 확인 후 조회·오류 처리와 거래·카테고리 CRUD 연동.
4. HTTPS 배포 후 실제 iPhone 설치·Safe Area·PWA 업데이트 검증.

이번 작업에서는 기존 iOS 코드, 운영 API, 서버·DB·Nginx 설정을 변경하지 않습니다.
