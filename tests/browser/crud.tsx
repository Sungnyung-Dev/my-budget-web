import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Category, LedgerData, Transaction } from '../../src/domain/types'
import { dateKey } from '../../src/domain/dates'
import { formatMoney } from '../../src/domain/formatters'
import { Summary } from '../../src/components/Summary'
import '../../src/index.css'

// 이 진입점은 Vite로만 실행합니다. 실제 fetch로 넘어가는 경로는 없습니다.
const now = new Date()
const today = dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
const fixture: LedgerData = {
  version: 1,
  categories: [
    { id: 'food', type: 'expense', name: '식비', symbol: 'food' },
    { id: 'salary', type: 'income', name: '급여', symbol: 'income' },
  ],
  transactions: [
    { id: 'existing', date: today, type: 'expense', amount: 100, categoryId: 'food', memo: '기존 거래' },
    { id: 'last-year', date: `${now.getFullYear() - 1}-12-31`, type: 'expense', amount: 200, categoryId: 'food', memo: '작년 거래' },
  ],
}
let server = structuredClone(fixture)
const requests: { method: string; path: string; body: Record<string, unknown> }[] = []
type Plan = 'hold' | 'reject' | 'timeoutCommitted' | 'networkCommitted' | 'serverError'
let writePlan: Plan | null = null
let readError = false
let readHold = false
let releaseRead: (() => void) | null = null
let release: (() => void) | null = null
let sequence = 0
let finalTransaction = false

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
globalThis.fetch = async (input, options) => {
  const path = String(input)
  const method = options?.method ?? 'GET'
  const body = JSON.parse(String(options?.body ?? '{}')) as Record<string, unknown>
  if (!/^\/api\/v1\/(ledger|transactions(?:\/[^/]+)?|categories(?:\/[^/]+)?)$/.test(path)) throw new Error('Unexpected mock path')
  requests.push({ method, path, body })
  if (method === 'GET' && path === '/api/v1/ledger') {
    const response = () => {
      if (readError) { readError = false; return json({ internal: 'PRIVATE_SERVER_DETAIL' }, 503) }
      return json(server)
    }
    if (readHold) {
      readHold = false
      return new Promise<Response>((resolve) => { releaseRead = () => resolve(response()) })
    }
    return response()
  }
  if (!['POST', 'PATCH', 'DELETE'].includes(method) || path.endsWith('/ledger')) throw new Error('Unexpected mock method')
  const plan = writePlan
  writePlan = null
  if (plan === 'reject') return json({ internal: 'PRIVATE_SERVER_DETAIL' }, 409)
  if (plan === 'serverError') return json({ internal: 'PRIVATE_SERVER_DETAIL' }, 500)
  function apply() {
    const transaction = path.startsWith('/api/v1/transactions')
    const rows = transaction ? server.transactions : server.categories
    const id = decodeURIComponent(path.split('/')[4] ?? '')
    if (method === 'POST') {
      const value: Record<string, unknown> = { ...body, id: `server-${++sequence}` }
      if (transaction && finalTransaction) { value.amount = 1250; value.memo = '서버 점심'; finalTransaction = false }
      if (transaction) server.transactions.push(value as unknown as Transaction)
      else server.categories.push(value as unknown as Category)
      return json(value, 201)
    }
    const index = rows.findIndex((row) => row.id === id)
    if (index < 0) return json({}, 404)
    if (method === 'PATCH') {
      Object.assign(rows[index], body)
      return json(rows[index])
    }
    rows.splice(index, 1)
    return new Response(null, { status: 204 })
  }
  if (plan === 'hold') return new Promise<Response>((resolve) => { release = () => resolve(apply()) })
  const response = apply()
  if (plan === 'timeoutCommitted') return new Promise<Response>((resolve) => { release = () => resolve(response) })
  if (plan === 'networkCommitted') throw new TypeError('PRIVATE_SERVER_DETAIL')
  return response
}

const checks: string[] = []
function check(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label)
  checks.push(label)
}
const pause = (ms = 35) => new Promise<void>((resolve) => setTimeout(resolve, ms))
async function until(test: () => unknown, label: string, timeout = 2500) {
  const start = performance.now()
  while (!test()) {
    if (performance.now() - start > timeout) throw new Error(`대기 실패: ${label}`)
    await pause()
  }
}
function get<T extends Element = HTMLElement>(selector: string, scope: ParentNode = document): T {
  const node = scope.querySelector<T>(selector)
  if (!node) throw new Error(`요소 없음: ${selector}`)
  return node
}
function button(name: string, scope: ParentNode = document) {
  const node = [...scope.querySelectorAll<HTMLButtonElement>('button')].find((item) =>
    (item.getAttribute('aria-label') === name || item.textContent?.trim().startsWith(name)) && item.getClientRects().length)
  if (!node) throw new Error(`버튼 없음: ${name}`)
  return node
}
async function click(name: string, scope: ParentNode = document) {
  const node = button(name, scope)
  if (node.matches(':disabled')) throw new Error(`비활성 버튼 클릭: ${name}`)
  node.click()
  await pause()
}
async function input(selector: string, value: string) {
  const node = get<HTMLInputElement>(selector)
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value)
  node.dispatchEvent(new Event('input', { bubbles: true }))
  await pause()
}
const sheet = () => get<HTMLDialogElement>('dialog[open]')
const sheetOpen = () => !!document.querySelector('dialog[open]')
const writes = () => requests.filter((row) => row.method !== 'GET').length
async function nav(name: string) { await click(name, get(innerWidth >= 1024 ? '.desktop-nav' : '.bottom-nav')) }
async function close() { await click(sheet().querySelector('.bottom-sheet-close')!.getAttribute('aria-label')!, sheet()); await until(() => !sheetOpen(), '시트 닫기') }
async function addTransaction(memo: string, amount = '1200') {
  await nav('내역')
  await click('선택한 날짜에 거래 추가')
  await input('#transaction-amount', amount)
  await input('#transaction-memo', memo)
}
async function manage() { await nav('설정'); await click('카테고리 관리') }
async function addCategory(name: string, type = '지출') {
  await click(`${type} 카테고리 추가`)
  await input('#category-name', name)
}
async function openTransaction(memo: string) {
  const row = [...document.querySelectorAll<HTMLButtonElement>('.ledger-transaction')].find((item) => item.textContent?.includes(memo))
  if (!row) throw new Error(`거래 없음: ${memo}`)
  row.click(); await pause()
}
function invariantLayout() {
  check(document.documentElement.scrollWidth <= innerWidth, '화면 가로 넘침 없음')
  check(get('.main-content').scrollWidth <= get('.main-content').clientWidth + 1, '본문 가로 넘침 없음')
  check(get(innerWidth >= 1024 ? '.sidebar' : '.bottom-nav').getBoundingClientRect().width > 0, '반응형 탐색 표시')
}
async function summaries(expense: number) {
  await nav('홈')
  check(get('.home-amount').textContent === `₩ ${formatMoney(expense)}`, '홈 최신 합계')
  await nav('내역')
  check(get('.summary-strip div:nth-child(2) dd').textContent === formatMoney(expense), '내역 최신 합계')
  await nav('통계')
  check(get('.summary-strip div:nth-child(2) dd').textContent === formatMoney(expense), '통계 월간 최신 합계')
  await click('연간')
  check(get('.summary-strip div:nth-child(2) dd').textContent === formatMoney(expense), '통계 연간 연도 경계 합계')
  check(get(`.year-chart-month:nth-of-type(${now.getMonth() + 1})`).getAttribute('aria-label')?.includes(`지출 ${expense.toLocaleString('ko-KR')}원`), '12개월 차트 최신 값')
}

async function fullCrud() {
  await addTransaction('점심')
  writePlan = 'hold'; finalTransaction = true
  const before = writes()
  await click('거래 저장', sheet())
  sheet().querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  check(writes() === before + 1, '거래 중복 submit 방지')
  check([...sheet().querySelectorAll('input,button')].every((node) => node.matches(':disabled')), '저장 중 입력·삭제·취소·닫기 잠금')
  const cancel = new Event('cancel', { cancelable: true })
  sheet().dispatchEvent(cancel)
  check(cancel.defaultPrevented && sheetOpen(), '저장 중 Escape 방지')
  sheet().dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: -10, clientY: -10 }))
  check(sheetOpen(), '저장 중 배경 닫기 방지')
  check(!get('.history-daily-column').textContent?.includes('서버 점심'), '거래 낙관적 표시 없음')
  check(server.transactions.length === fixture.transactions.length, '서버 응답 전 거래 유지')
  release!(); release = null
  await until(() => !sheetOpen(), '거래 생성 성공 닫기')
  check(get('.history-daily-column').textContent?.includes('서버 점심'), '서버 최종 거래 표시')
  await summaries(1350)
  await manage()
  check(button('식비, 카테고리 수정').textContent?.includes('3건 사용'), '사용 건수는 과거 연도 포함')
  await nav('홈')
  await openTransaction('서버 점심')
  check(get<HTMLInputElement>('#transaction-amount').value === '1,250', '홈 거래 선택으로 수정')
  await input('#transaction-amount', '2000')
  await input('#transaction-memo', '수정 점심')
  await click('변경사항 저장', sheet())
  await until(() => !sheetOpen(), '거래 수정 성공 닫기')
  check(requests.at(-1)?.method === 'PATCH' && requests.at(-1)?.path.includes('/server-'), '거래 서버 ID로 PATCH')
  await summaries(2100)
  await nav('내역'); await openTransaction('수정 점심')
  await click('거래 삭제', sheet())
  check(button('변경사항 저장', sheet()).matches(':disabled'), '삭제 확인 중 저장 차단')
  writePlan = 'reject'
  await click('삭제 확인', sheet())
  check(sheetOpen() && !!sheet().querySelector('.sheet-delete-confirm'), '거래 삭제 거절 시 확인 유지')
  check(get<HTMLInputElement>('#transaction-memo').value === '수정 점심', '거래 삭제 거절 시 입력 유지')
  check(!sheet().textContent?.includes('PRIVATE_SERVER_DETAIL'), '거래 오류 내부정보 숨김')
  writePlan = 'hold'
  const transactionDeletes = writes()
  await click('삭제 확인', sheet())
  button('삭제 확인', sheet()).click()
  check(writes() === transactionDeletes + 1 && sheetOpen(), '거래 삭제 중복 클릭 차단')
  check(get('.history-daily-column').textContent?.includes('수정 점심'), '거래는 삭제 204 전까지 유지')
  release!(); release = null
  await until(() => !sheetOpen(), '거래 삭제 성공 닫기')
  await summaries(100)

  await manage(); await addCategory(' 식비 ')
  const duplicateBefore = writes()
  await click('카테고리 추가', sheet())
  check(writes() === duplicateBefore && get('#category-name-error').textContent?.includes('이미'), '중복 이름 도메인 검증·전송 차단')
  await input('#category-name', ' 독서 ')
  writePlan = 'hold'
  await click('카테고리 추가', sheet())
  sheet().querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  check(writes() === duplicateBefore + 1, '카테고리 중복 submit 방지')
  check([...sheet().querySelectorAll('input,button')].every((node) => node.matches(':disabled')), '카테고리 저장 중 전체 입력 잠금')
  check(!get('.categories-workspace').textContent?.includes('독서'), '카테고리 낙관적 표시 없음')
  release!(); release = null
  await until(() => !sheetOpen(), '카테고리 생성 성공 닫기')
  check(requests.at(-1)?.body.name === '독서' && requests.at(-1)?.body.symbol === 'other', '새 지출 카테고리 정규화·기본 심볼')
  await click('독서, 카테고리 수정')
  await input('#category-name', '취미')
  writePlan = 'reject'; await click('이름 변경 저장', sheet())
  check(get<HTMLInputElement>('#category-name').value === '취미' && sheetOpen(), '카테고리 수정 거절 시 입력 유지')
  await click('이름 변경 저장', sheet())
  await until(() => !sheetOpen(), '카테고리 수정 성공 닫기')
  check(requests.at(-1)?.path.includes('/server-') && Object.keys(requests.at(-1)!.body).join() === 'name', '카테고리 서버 ID·이름만 수정')
  await click('취미, 카테고리 수정'); await click('카테고리 삭제', sheet())
  writePlan = 'reject'; await click('삭제 확인', sheet())
  check(!!sheet().querySelector('.sheet-delete-confirm') && get<HTMLInputElement>('#category-name').value === '취미', '카테고리 삭제 거절 시 입력·확인 유지')
  writePlan = 'hold'
  const categoryDeletes = writes()
  await click('삭제 확인', sheet())
  button('삭제 확인', sheet()).click()
  check(writes() === categoryDeletes + 1 && sheetOpen(), '카테고리 삭제 중복 클릭 차단')
  check(get('.categories-workspace').textContent?.includes('취미'), '카테고리는 삭제 204 전까지 유지')
  release!(); release = null
  await until(() => !sheetOpen(), '카테고리 삭제 성공 닫기')
  check(!get('.categories-workspace').textContent?.includes('취미'), '서버 확인 후 카테고리 제거')
  await click('식비, 카테고리 수정')
  check(button('카테고리 삭제', sheet()).matches(':disabled') && sheet().textContent?.includes('거래 2건'), '사용 중 카테고리 삭제 제한·실시간 사용 건수')
  await input('#category-name', '식사')
  await click('이름 변경 저장', sheet())
  await until(() => !sheetOpen(), '사용 중 카테고리 이름 변경 성공')
  await nav('홈')
  check(get('.home-details').textContent?.includes('식사') && !get('.home-details').textContent?.includes('식비'), '카테고리 이름 변경 홈 반영')
  await nav('통계')
  check(get('.stats-workspace').textContent?.includes('식사'), '카테고리 이름 변경 통계 반영')
  await manage(); await addCategory('부수입', '수입')
  await click('카테고리 추가', sheet())
  await until(() => !sheetOpen(), '수입 카테고리 생성')
  check(requests.at(-1)?.body.symbol === 'income' && requests.at(-1)?.body.type === 'income', '수입 기본 심볼·유형')

  await addTransaction('거절 입력', '500')
  writePlan = 'reject'; await click('거래 저장', sheet())
  check(get<HTMLInputElement>('#transaction-memo').value === '거절 입력' && get<HTMLInputElement>('#transaction-amount').value === '500', '거래 생성 거절 시 입력 유지')
  await click('거래 저장', sheet()); await until(() => !sheetOpen(), '거절 후 명시적 거래 저장 성공')
  await openTransaction('거절 입력')
  await input('#transaction-memo', '수정 거절')
  writePlan = 'reject'; await click('변경사항 저장', sheet())
  check(get<HTMLInputElement>('#transaction-memo').value === '수정 거절', '거래 수정 거절 시 입력 유지')
  await click('거래 삭제', sheet())
  writePlan = 'networkCommitted'; await click('삭제 확인', sheet())
  check(!!sheet().querySelector('.sheet-delete-confirm') && button('삭제 확인', sheet()).matches(':disabled'), '불확실 거래 삭제는 확인 유지·추가 삭제 차단')
  const blockedWrites = writes()
  sheet().querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  check(writes() === blockedWrites, '불확실 거래의 재전송 없음')
  await click('서버 데이터 다시 조회', sheet())
  check(get<HTMLInputElement>('#transaction-memo').value === '수정 거절' && !!sheet().querySelector('.sheet-delete-confirm'), '재조회 후 거래 입력·삭제 확인 유지')
  check(button('삭제 확인', sheet()).matches(':disabled') && sheet().textContent?.includes('서버 목록에 없습니다'), '재조회로 삭제 확인된 대상 재삭제 방지')
  await close()

  await manage(); await addCategory('타임아웃 입력')
  writePlan = 'reject'; await click('카테고리 추가', sheet())
  check(get<HTMLInputElement>('#category-name').value === '타임아웃 입력', '카테고리 생성 거절 시 입력 유지')
  writePlan = 'timeoutCommitted'; await click('카테고리 추가', sheet())
  await until(() => sheet().textContent?.includes('추가 저장·삭제를 중단'), '실제 클라이언트 타임아웃', 11_000)
  check(get<HTMLInputElement>('#category-name').value === '타임아웃 입력', '타임아웃 후 입력 유지')
  const timeoutWrites = writes()
  check(button('카테고리 추가', sheet()).matches(':disabled'), '타임아웃 후 저장 차단')
  sheet().querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await pause()
  check(writes() === timeoutWrites, '타임아웃 자동 재시도·재전송 없음')
  readError = true; await click('서버 데이터 다시 조회', sheet())
  check(button('카테고리 추가', sheet()).matches(':disabled') && get<HTMLInputElement>('#category-name').value === '타임아웃 입력', '재조회 실패 후 차단·입력 유지')
  check(!get('.categories-workspace').textContent?.includes('타임아웃 입력'), '재조회 실패 시 기존 목록 유지')
  readHold = true
  await click('서버 데이터 다시 조회', sheet())
  check([...sheet().querySelectorAll('input,button')].every((node) => node.matches(':disabled')), '재조회 중 입력·저장·닫기 잠금')
  releaseRead!(); releaseRead = null
  await until(() => sheet().textContent?.includes('다시 불러왔습니다'), '재조회 완료')
  check(get<HTMLInputElement>('#category-name').value === '타임아웃 입력' && sheetOpen(), '재조회 성공도 폼 초기화·닫기 없음')
  check(sheet().textContent?.includes('목록에서 처리 결과를 먼저 확인'), '재조회 후 목록 확인 안내')
  check(!button('카테고리 추가', sheet()).matches(':disabled'), '검증된 GET 성공 후 쓰기 잠금 해제')
  release!(); release = null; await pause()
  check(get<HTMLInputElement>('#category-name').value === '타임아웃 입력', '타임아웃 늦은 응답은 폼 유지')
  await close()
  check(!!button('타임아웃 입력, 카테고리 수정'), '서버에 처리된 생성 결과는 재조회로 확인')
  await addCategory('다음 입력'); await click('카테고리 추가', sheet())
  await until(() => !sheetOpen(), '결과 확인 후 다음 명시적 저장 성공')
  await addTransaction('서버 오류 입력', '700')
  writePlan = 'serverError'; await click('거래 저장', sheet())
  check(button('거래 저장', sheet()).matches(':disabled') && get<HTMLInputElement>('#transaction-memo').value === '서버 오류 입력', '5xx 후 입력 유지·쓰기 차단')
  await close()
  check(get('.ledger-status').textContent?.includes('추가 저장·삭제를 중단'), '시트를 닫아도 공통 재조회 안내 유지')
  await click('선택한 날짜에 거래 추가')
  check(button('거래 저장', sheet()).matches(':disabled'), '다른 시트를 열어도 불확실 결과의 쓰기 차단')
  await close()
  await click('서버 데이터 다시 조회', get('.ledger-status'))
  check(!document.body.textContent?.includes('PRIVATE_SERVER_DETAIL'), '전체 화면 내부정보 노출 없음')
  check(!document.body.textContent?.includes('UI 미리보기') && !document.body.textContent?.includes('읽기 전용'), '미연결·개발용 UI 정리')
  check(requests.filter((row) => row.method === 'GET').length === 6, 'StrictMode·탭 전환·CRUD는 불필요한 GET 없음')
}

async function displayUi() {
  const holder = document.createElement('div')
  holder.hidden = true
  document.body.append(holder)
  const sample = createRoot(holder)
  sample.render(<Summary variant="ledger" />)
  await pause()
  check([...holder.querySelectorAll('dd')].every((node) => node.textContent === '—'), '준비 전 Summary는 가짜 0 표시 없음')
  sample.render(<Summary unavailable totals={{ income: 1000, expense: 1, balance: 999 }} />)
  await pause()
  check([...holder.querySelectorAll('dd')].every((node) => node.textContent === '—원'), '명시적 미준비 Summary는 기존 값 대신 미연결 표시')
  sample.unmount(); holder.remove()

  server = { version: 1, categories: structuredClone(fixture.categories), transactions: [] }
  await nav('설정'); await click('서버 데이터 새로고침')
  await nav('홈')
  check(get('.home-amount').textContent === '₩ 0' && get('.home-balance strong').textContent === '0원', '정상 빈 홈 합계·차액은 0')
  check([...document.querySelectorAll('.home-mini-stats dd')].map((node) => node.textContent).join() === '0원,0건', '정상 빈 홈 수입·건수는 0')
  await nav('내역')
  check([...document.querySelectorAll('.summary-strip dd')].every((node) => node.textContent === '0'), '정상 빈 내역의 모든 합계는 0')
  check(get('.ledger-day-meta').textContent === '수입 0지출 0' && get('.ledger-count').textContent === '0건', '선택일의 빈 수입·지출·건수는 부호 없는 0')
  await nav('통계')
  check([...document.querySelectorAll('.summary-strip dd')].every((node) => node.textContent === '0'), '정상 빈 월간 통계 합계 0')
  check([...document.querySelectorAll('.stats-information dd')].map((node) => node.textContent).join() === '0건,0일,0원', '정상 빈 소비 지표는 0')
  await click('연간')
  check([...document.querySelectorAll('.summary-strip dd')].every((node) => node.textContent === '0'), '정상 빈 연간 통계 합계 0')
  check([...document.querySelectorAll('.year-chart-month')].every((node) => node.getAttribute('aria-label')?.includes('수입 0원, 지출 0원')), '빈 차트도 조회된 월은 실제 0 금액 제공')

  const rows: Transaction[] = Array.from({ length: 996 }, (_, index) => ({
    id: `count-${index}`, date: today, type: 'expense', amount: 1, categoryId: 'food', memo: '기록',
  }))
  for (const [memo, amount] of [['금액 가', 1], ['금액 나', 1000], ['금액 다', 10000], ['금액 라', 1000000]] as const) {
    rows.push({ id: memo, date: today, type: 'expense', amount, categoryId: 'food', memo })
  }
  server.transactions = rows
  await nav('설정'); await click('서버 데이터 새로고침')
  check(get('#settings-connection-note').textContent?.includes('거래 1,000건'), '설정 거래 건수 쉼표')
  await nav('홈')
  check(get('.home-amount').textContent === '₩ 1,011,997', '홈 금액 쉼표')
  check(get('.home-balance strong').textContent === '−1,011,997원', '음수 차액의 부호·쉼표')
  check(get('.home-mini-stats div:last-child dd').textContent === '1,000건', '홈 거래 건수 쉼표')
  check(get('.category-bar-text strong').textContent === '1,011,997원 · 100%', '카테고리 지출의 공통 금액 포맷')
  await nav('내역')
  check(get('.ledger-count').textContent === '1,000건', '내역 거래 건수 쉼표')
  check(get('.ledger-day-meta').textContent === '수입 0지출 −1,011,997', '날짜별 지출의 공통 부호·쉼표')
  for (const [memo, text] of [['금액 가', '−1원'], ['금액 나', '−1,000원'], ['금액 다', '−10,000원'], ['금액 라', '−1,000,000원']]) {
    const row = [...document.querySelectorAll('.ledger-transaction')].find((node) => node.textContent?.includes(memo))
    check(row?.querySelector('.ledger-transaction-amount')?.textContent === text, `거래 목록 ${text}`)
  }
  const main = get('.main-content')
  const fab = get('.ledger-fab')
  const wrapper = get('.ledger-fab-position')
  const rect = fab.getBoundingClientRect()
  const bottomNav = get('.bottom-nav').getBoundingClientRect()
  check(rect.width === 45 && rect.height === 45 && getComputedStyle(fab).borderRadius === '50%', 'FAB 45px 원형 크기 유지')
  check(getComputedStyle(wrapper).backgroundColor === 'rgba(0, 0, 0, 0)' && wrapper.getBoundingClientRect().height === 45, 'FAB 바깥 컨테이너는 투명·버튼 높이만 사용')
  check(Math.abs(rect.bottom - (innerHeight - bottomNav.height - 13)) <= 1, 'FAB의 탭 위 13px 위치 유지')
  check(Math.abs(main.getBoundingClientRect().bottom - (innerHeight - bottomNav.height)) <= 1, '스크롤 본문이 FAB 아래까지 이어짐·흰 띠 여백 없음')
  check(main.contains(document.elementFromPoint(rect.left - 10, rect.top + 22)), 'FAB 바깥 영역은 아래 본문에 접근 가능')
  main.scrollTop = main.scrollHeight
  await pause()
  check(get('.ledger-transactions li:last-child').getBoundingClientRect().bottom <= rect.top - 16, '스크롤 끝의 마지막 거래는 FAB와 겹치지 않음')
  if (innerWidth < 1024) {
    const layout = get('.app-layout')
    layout.style.setProperty('--bottom-nav-height', '110px')
    check(Math.abs(fab.getBoundingClientRect().bottom - (innerHeight - 110 - 13)) <= 1, 'Safe Area를 포함한 탭 높이 변화에 FAB 위치 대응')
    layout.style.removeProperty('--bottom-nav-height')
  }
  main.scrollTop = 0
  await click('선택한 날짜에 거래 추가')
  check(sheetOpen(), '투명 FAB의 기존 생성 클릭 동작 유지')
  await input('#transaction-amount', '0')
  const before = writes()
  await click('거래 저장', sheet())
  check(writes() === before && get('#transaction-error').textContent?.includes('1원부터'), '표시 변경 뒤에도 금액 0 입력 검증 유지')
  await input('#transaction-amount', '1.5'); await click('거래 저장', sheet())
  check(writes() === before && get('#transaction-error').textContent?.includes('정수'), '표시 변경 뒤에도 소수 입력 검증 유지')
  await close()
  await nav('통계')
  check(get('.stats-information div:first-child dd').textContent === '1,000건', '통계 지출 건수 쉼표')
  await click('연간')
  check(get(`.year-chart-month:nth-of-type(${now.getMonth() + 1})`).getAttribute('aria-label')?.includes('지출 1,011,997원'), '연간 차트 금액 공통 포맷')
  await manage(); await click('식비, 카테고리 수정')
  check(sheet().textContent?.includes('거래 1,000건') && button('카테고리 삭제', sheet()).matches(':disabled'), '카테고리 사용 경고의 건수 쉼표·삭제 제한 유지')
  await close()
  check(button('식비, 카테고리 수정').textContent?.includes('1,000건 사용'), '카테고리 목록 사용 건수 쉼표')

  server.categories = [...fixture.categories, ...Array.from({ length: 998 }, (_, index): Category => ({
    id: `category-${index}`, name: `분류 ${index}`, type: 'expense', symbol: 'other',
  }))]
  await nav('홈'); await nav('설정'); await click('서버 데이터 새로고침')
  check(get('#settings-connection-note').textContent?.includes('카테고리 1,000개'), '설정 카테고리 개수 쉼표')
  server = structuredClone(fixture)
  server.transactions = [
    { ...fixture.transactions[0], amount: 1000 },
    { id: 'balance-income', date: today, type: 'income', amount: 1000, categoryId: 'salary', memo: '수입', },
  ]
  await click('서버 데이터 새로고침'); await nav('홈')
  check(get('.home-balance strong').textContent === '0원', '거래가 있어도 차액 계산 결과 0은 부호 없는 0')
  await nav('내역')
  check(get('.summary-strip div:last-child dd').textContent === '0', '거래가 있는 내역의 차액 0')
  await nav('통계')
  check(get('.summary-strip div:last-child dd').textContent === '0', '거래가 있는 통계의 차액 0')
}

async function layouts() {
  for (const name of ['홈', '내역', '통계', '설정']) {
    await nav(name); invariantLayout()
    check(!document.querySelector('.desktop-topbar') && !document.body.textContent?.includes('매일의 기록, 한눈에.'), '상단 공통 헤더 요소·문구 제거')
    check(get('.page-header .eyebrow').textContent === 'MY LEDGER' && get('h1').textContent === name, '화면 내부 제목·MY LEDGER 유지')
    if (innerWidth >= 1024) check(get('.main-content').getBoundingClientRect().top === 0, 'PC 본문은 헤더 잔여 높이 없이 최상단 시작')
  }
  await manage(); invariantLayout()
  await addCategory('반응형 이름')
  check(sheet().getBoundingClientRect().width <= Math.min(innerWidth, 580), '시트 모바일·PC 폭 유지')
  check(get('.bottom-sheet-body').scrollHeight >= get('.bottom-sheet-body').clientHeight, '시트 내부 스크롤')
  await close()
  await addTransaction('반응형 메모')
  check(sheet().getBoundingClientRect().width <= Math.min(innerWidth, 580), '거래 시트 반응형 폭')
  check(sheet().getBoundingClientRect().height <= innerHeight * .92 + 1, '거래 시트 화면 높이 제한')
  await close()
  // 서버의 정상 빈 배열과 카테고리만 있는 경우도 생성 진입이 가능합니다.
  server = { version: 1, transactions: [], categories: [] }
  await nav('설정'); await click('서버 데이터 새로고침')
  await click('카테고리 관리'); await addCategory('빈 서버 첫 카테고리')
  await click('카테고리 추가', sheet()); await until(() => !sheetOpen(), '빈 서버 카테고리 생성')
  await addTransaction('빈 서버 첫 거래', '300')
  check(get('.transaction-chips').textContent?.includes('빈 서버 첫 카테고리'), '카테고리만 존재 시 실제 선택지')
  await click('거래 저장', sheet()); await until(() => !sheetOpen(), '빈 서버 첫 거래 생성')
  check(get('.history-daily-column').textContent?.includes('빈 서버 첫 거래'), '빈 서버 첫 거래 표시')
  await summaries(300)
  await nav('홈'); invariantLayout()
}

try {
  const { LedgerApp: App } = await import('../../src/App')
  readHold = true
  createRoot(get('#root')).render(<StrictMode><App onLogout={async () => {}} /></StrictMode>)
  await until(() => releaseRead, '최초 조회 대기')
  check(requests.length === 1, '최초 GET 한 번')
  check(!document.querySelector('.home-page') && get('.ledger-status').textContent?.includes('불러오는 중'), '최초 로딩을 0원 화면과 구분')
  readError = true; releaseRead!(); releaseRead = null
  await until(() => get('.ledger-status').getAttribute('role') === 'alert', '최초 조회 실패')
  check(!document.querySelector('.home-page') && !document.querySelector('.summary-strip'), '조회 실패를 정상 0원 화면과 구분')
  await click('다시 시도')
  await until(() => document.querySelector('.home-page'), '최초 재시도 성공')
  if (new URLSearchParams(location.search).get('full') === 'true') await fullCrud()
  await displayUi()
  await layouts()
  parent.postMessage({ type: 'ledger-ui-qa', width: innerWidth, passed: true, checks: checks.length }, location.origin)
} catch (error) {
  parent.postMessage({ type: 'ledger-ui-qa', width: innerWidth, passed: false, checks: checks.length, error: error instanceof Error ? error.message : String(error) }, location.origin)
}
