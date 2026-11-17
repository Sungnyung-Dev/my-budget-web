# 쿠키 로그인 배포 자료

검토용 설정이며 자동 설치·적용하지 않습니다. 실제 운영 적용은 별도 승인 후 backend의 `docs/persistent-sessions-rollout.ko.md`에 따라 수행합니다.

- `budget-web`, `budget-api`: 현재 양쪽 Basic을 유지하는 기준 설정. rollback은 적용 직전의 실제 보호된 설정 백업을 사용합니다.
- `my-budget-auth.conf`: 기존 htpasswd 경로 참조만 포함합니다. 계정·해시 자체는 저장소에 넣지 않습니다.
- `my-budget-proxy.conf`: 기존 루프백 3004, Authorization 제거, API no-store 설정. 신규 병행 프로세스 3005는 이 파일을 직접 덮어쓰지 말고 별도 후보 snippet을 준비합니다.
- `budget-web.session.example`: 검증·승인 후 웹 Basic만 조정하는 앱 셸 공개 예시입니다. 기존 API Basic은 유지합니다. 실제 적용에서는 후보 backend 포트의 전용 snippet을 참조해야 합니다.

Manifest `useCredentials: true`는 Basic 유지 전환 단계에 필요하며 앱 셸 공개 후에도 같은 출처 인증정보만 전달합니다. API 캐시 정책은 바꾸지 않습니다. `npm ci --include=dev`, typecheck, lint, test, build로 새 clone에서 확인합니다.

과거의 인증 계정 생성·변경 도구와 초기 HTTP bootstrap은 이 전환에 필요하지 않습니다. 기존 로컬 작업에 남아 있어도 실행하지 않습니다. Nginx Basic 401을 Express 세션 보호의 증거로 인정하지 않습니다. 올바른 Basic 헤더를 보낸 뒤 Cookie만 제외하여 JSON UNAUTHENTICATED 401과 WWW-Authenticate 없음·no-store를 확인해야 합니다.

[Manifest 인증정보 전달에 대한 공식 설명](https://vite-pwa-org.netlify.app/guide/faq#web-app-manifest-and-401-status-code-unauthorized)
