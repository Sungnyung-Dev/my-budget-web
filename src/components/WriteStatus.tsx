import type { LedgerState, WriteFailure } from '../state/ledgerStore'

export function WriteStatus({ id, state, failure, onReload }: {
  id: string
  state: LedgerState
  failure: WriteFailure | null
  onReload: () => Promise<boolean>
}) {
  const busy = state.saving || state.status === 'refreshing'
  const recovered = failure?.needsRefresh && !state.needsRefresh
  return (
    <div id={id}>
      {failure && !failure.needsRefresh && <p className="sheet-error" role="alert">{failure.message}</p>}
      {state.needsRefresh && (
        <div className="sheet-notice" role="alert">
          <p>서버에 이미 반영되었을 수 있습니다. 추가 저장·삭제를 중단했습니다. 서버 데이터를 다시 조회하고 목록에서 처리 결과를 확인해 주세요. 입력값은 유지됩니다.</p>
          {state.error && <p>{state.error}</p>}
          <button type="button" className="sheet-secondary" disabled={busy} onClick={() => void onReload()}>{state.status === 'refreshing' ? '서버 확인 중…' : '서버 데이터 다시 조회'}</button>
        </div>
      )}
      {recovered && <p className="sheet-notice" role="status">서버 데이터를 다시 불러왔습니다. 입력값은 유지했습니다. 시트를 닫고 목록에서 처리 결과를 먼저 확인해 주세요. 다시 저장하면 새로운 요청을 보냅니다.</p>}
      {busy && <p className="sheet-notice" role="status">{state.saving ? '서버에 저장 중입니다. 처리가 끝날 때까지 기다려 주세요.' : '서버 데이터를 확인 중입니다. 입력값은 유지됩니다.'}</p>}
    </div>
  )
}
