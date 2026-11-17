import type { LedgerState } from '../state/ledgerStore'

export function LedgerStatus({ state, onReload }: { state: LedgerState; onReload: () => Promise<boolean> }) {
  if (state.status === 'ready' && !state.error && !state.needsRefresh) return null
  const busy = state.status === 'loading' || state.status === 'refreshing'
  const message = busy
    ? state.data ? '서버 데이터를 새로 불러오는 중입니다. 기존 데이터를 표시합니다.' : '서버의 가계부를 불러오는 중입니다.'
    : state.error
  return (
    <section className={`ledger-status ${state.data ? 'is-notice' : 'is-initial'}`} role={state.error || state.needsRefresh ? 'alert' : 'status'}>
      {message && <p>{message}</p>}
      {state.data && state.error && <p>마지막으로 불러온 데이터를 표시합니다.</p>}
      {state.needsRefresh && <p>서버에 이미 반영되었을 수 있어 추가 저장·삭제를 중단했습니다. 다시 조회한 뒤 목록에서 처리 결과를 확인해 주세요.</p>}
      {!busy && <button type="button" className="primary-button" disabled={state.saving} onClick={() => void onReload()}>{state.needsRefresh ? '서버 데이터 다시 조회' : '다시 시도'}</button>}
    </section>
  )
}
