import type { LedgerState } from '../state/ledgerStore'

export function LedgerStatus({ state, onReload }: { state: LedgerState; onReload: () => Promise<boolean> }) {
  if (state.status === 'ready' && !state.error) return null
  const busy = state.status === 'loading' || state.status === 'refreshing'
  return (
    <section className={`ledger-status ${state.data ? 'is-notice' : 'is-initial'}`} role={state.error ? 'alert' : 'status'}>
      <p>{busy
        ? state.data ? '서버 데이터를 새로 불러오는 중입니다. 기존 데이터를 표시합니다.' : '서버의 가계부를 불러오는 중입니다.'
        : state.error}</p>
      {state.data && state.error && <p>마지막으로 불러온 데이터를 표시합니다.</p>}
      {!busy && <button type="button" className="primary-button" onClick={() => void onReload()}>다시 시도</button>}
    </section>
  )
}
