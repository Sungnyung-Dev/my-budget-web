import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import type { Category, TransactionType } from '../domain/types'
import { validateCategoryName } from '../domain/validateLedger'
import { ledgerCategories } from '../app/ledgerViews'
import { formatNumber } from '../domain/formatters'
import type { LedgerController } from '../state/useLedger'
import { useWriteAction } from '../state/useWriteAction'
import { WriteStatus } from './WriteStatus'

export type CategoryEditorTarget = { mode: 'add'; type: TransactionType }
  | { mode: 'edit'; type: TransactionType; category: Category }

export function CategoryEditor({ target, ledger, onClose }: {
  target: CategoryEditorTarget
  ledger: LedgerController
  onClose: () => void
}) {
  const { state } = ledger
  const busy = state.saving || state.status === 'refreshing'
  const blocked = busy || state.needsRefresh
  const { failure, run } = useWriteAction(onClose)
  const category = target.mode === 'edit' ? target.category : undefined
  const deleteButton = useRef<HTMLButtonElement>(null)
  const confirmCancel = useRef<HTMLButtonElement>(null)
  const [name, setName] = useState(category?.name ?? '')
  const [touched, setTouched] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const editing = target.mode === 'edit'
  const current = state.data && ledgerCategories(state.data).find((item) => item.id === category?.id)
  const uses = current?.usageCount ?? 0
  const missing = editing && !current
  let error = ''
  try {
    if (state.data) validateCategoryName(state.data, target.type, name, category?.id)
  } catch (reason) { error = (reason as Error).message }

  useEffect(() => {
    if (confirm) {
      confirmCancel.current?.focus()
      confirmCancel.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [confirm])

  function save() {
    setTouched(true)
    if (blocked || confirm || missing || error) return
    void run(() => category
      ? ledger.updateCategory(category.id, { name })
      : ledger.createCategory({ name, type: target.type, symbol: target.type === 'income' ? 'income' : 'other' }))
  }

  function remove() {
    if (category && !blocked && !missing && !uses) void run(() => ledger.deleteCategory(category.id))
  }

  return (
    <BottomSheet
      title={editing ? '카테고리 수정' : '카테고리 추가'}
      closeLabel="카테고리 입력 취소하고 닫기"
      descriptionId="category-editor-connection"
      busy={busy}
      onClose={onClose}
      onSubmit={(event) => { event.preventDefault(); save() }}
    >
      <p className="sheet-label">유형</p>
      <div className="sheet-fixed">{target.type === 'expense' ? '지출' : '수입'} 카테고리</div>
      <label className="sheet-label" htmlFor="category-name">카테고리 이름</label>
      <input
        id="category-name"
        className="sheet-input"
        name="categoryName"
        value={name}
        maxLength={20}
        autoComplete="off"
        placeholder="카테고리 이름 입력"
        aria-invalid={touched && !!error}
        aria-describedby="category-name-error category-editor-connection"
        onChange={(event) => setName(event.target.value)}
        onBlur={() => setTouched(true)}
      />
      <p id="category-name-error" className="sheet-error" role="alert">{touched ? error : ''}</p>
      <WriteStatus id="category-editor-connection" state={state} failure={failure} onReload={ledger.reload} />
      {missing && <p className="sheet-warning" role="alert">이 카테고리는 서버 목록에 없습니다. 시트를 닫고 처리 결과를 확인해 주세요.</p>}
      <button type="submit" className="sheet-primary" disabled={blocked || missing || confirm}>{state.saving ? '저장 중…' : editing ? '이름 변경 저장' : '카테고리 추가'}</button>
      {editing && !confirm && (
        <button ref={deleteButton} type="button" className="sheet-secondary" disabled={blocked || missing || uses > 0} onClick={() => setConfirm(true)}>
          카테고리 삭제
        </button>
      )}
      {uses > 0 && <p className="sheet-warning">거래 {formatNumber(uses)}건에서 사용 중이므로 삭제할 수 없습니다. 이름 변경은 기존 거래에도 적용됩니다.</p>}
      {confirm && (
        <section className="sheet-delete-confirm" aria-labelledby="category-delete-heading">
          <h3 id="category-delete-heading">이 카테고리를 삭제할까요?</h3>
          <p>삭제한 카테고리는 복구할 수 없습니다.</p>
          <button type="button" className="sheet-primary" disabled={blocked || missing || uses > 0} onClick={remove}>삭제 확인</button>
          <button ref={confirmCancel} type="button" className="sheet-secondary" onClick={() => { setConfirm(false); requestAnimationFrame(() => deleteButton.current?.focus()) }}>삭제 취소</button>
        </section>
      )}
      <button type="button" className="sheet-secondary" onClick={onClose}>취소</button>
    </BottomSheet>
  )
}
