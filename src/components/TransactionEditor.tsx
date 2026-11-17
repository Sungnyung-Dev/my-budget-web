import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import type { Transaction, TransactionType } from '../domain/types'
import { parseAmount } from '../domain/ledger'
import type { LedgerController } from '../state/useLedger'
import { useWriteAction } from '../state/useWriteAction'
import { WriteStatus } from './WriteStatus'
import './TransactionEditor.css'

export function TransactionEditor({ date, transaction, ledger, onClose }: {
  date: string
  transaction?: Transaction
  ledger: LedgerController
  onClose: () => void
}) {
  const { state } = ledger
  const categories = state.data?.categories ?? []
  const busy = state.saving || state.status === 'refreshing'
  const blocked = busy || state.needsRefresh
  const { failure, run } = useWriteAction(onClose)
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense')
  const [amount, setAmount] = useState(transaction ? transaction.amount.toLocaleString('ko-KR') : '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? categories.find((category) => category.type === 'expense')?.id ?? '')
  const [memo, setMemo] = useState(transaction?.memo ?? '')
  const [amountTouched, setAmountTouched] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const deleteCancel = useRef<HTMLButtonElement>(null)
  const options = categories.filter((category) => category.type === type)
  const categoryValid = options.some((category) => category.id === categoryId)
  const missing = !!transaction && !state.data?.transactions.some((row) => row.id === transaction.id)
  const fixedDate = transaction?.date ?? date
  const [year, month, day] = fixedDate.split('-').map(Number)
  const dateLabel = `${year}년 ${month}월 ${day}일 ${'일월화수목금토'[new Date(year, month - 1, day).getDay()]}요일`
  let amountValue = 0
  let amountError = ''
  try { amountValue = parseAmount(amount) } catch (error) {
    amountError = (error as Error).message
  }

  useEffect(() => {
    if (confirmDelete) {
      deleteCancel.current?.focus()
      deleteCancel.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [confirmDelete])

  function changeType(next: TransactionType) {
    if (next === type) return
    setType(next)
    setCategoryId(categories.find((category) => category.type === next)?.id ?? '')
  }

  function save() {
    setAmountTouched(true)
    if (blocked || confirmDelete || missing || amountError || !categoryValid || memo.length > 100) return
    const input = { type, amount: amountValue, categoryId, memo, date: fixedDate }
    void run(() => transaction ? ledger.updateTransaction(transaction.id, input) : ledger.createTransaction(input))
  }

  function remove() {
    if (transaction && !blocked && !missing) void run(() => ledger.deleteTransaction(transaction.id))
  }

  return (
    <BottomSheet
      id="transaction-editor"
      title={transaction ? '거래 수정' : '거래 추가'}
      closeLabel="거래 입력 취소하고 닫기"
      descriptionId="transaction-connection"
      busy={busy}
      onClose={onClose}
      onSubmit={(event) => { event.preventDefault(); save() }}
    >
      <div className="transaction-type" role="group" aria-label="거래 유형">
        <button type="button" aria-pressed={type === 'expense'} onClick={() => changeType('expense')}>지출</button>
        <button type="button" aria-pressed={type === 'income'} onClick={() => changeType('income')}>수입</button>
      </div>
      <label className="sheet-label" htmlFor="transaction-amount">금액</label>
      <div className="transaction-amount-line">
        <span aria-hidden="true">₩</span>
        <input
          id="transaction-amount"
          name="amount"
          aria-label="거래 금액"
          aria-invalid={amountTouched && !!amountError}
          aria-describedby="transaction-error"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={amount}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setAmount(event.target.value)}
          onBlur={() => {
            setAmountTouched(true)
            if (!amountError) setAmount(amountValue.toLocaleString('ko-KR'))
          }}
        />
      </div>
      <fieldset className="transaction-categories">
        <legend className="sheet-label">카테고리</legend>
        {options.length ? (
          <div className="transaction-chips">
            {options.map((category) => (
              <button type="button" key={category.id} className="transaction-chip" aria-pressed={category.id === categoryId} onClick={() => setCategoryId(category.id)}>{category.name}</button>
            ))}
          </div>
        ) : (
          <p className="transaction-categories-empty">이 유형으로 서버에 등록된 카테고리가 없습니다. 설정의 카테고리 관리에서 먼저 추가해 주세요.</p>
        )}
        {options.length > 0 && !categoryValid && <p className="sheet-error" role="alert">거래 유형에 맞는 카테고리를 선택해 주세요.</p>}
      </fieldset>
      <p className="sheet-label" id="transaction-date-label">기록 날짜</p>
      <div className="sheet-fixed" aria-labelledby="transaction-date-label">{dateLabel}</div>
      <label className="sheet-label" htmlFor="transaction-memo">내용 / 메모 (선택)</label>
      <input
        id="transaction-memo"
        name="memo"
        className="sheet-input"
        aria-label="거래 내용 또는 메모"
        autoComplete="off"
        placeholder="예: 점심 식사"
        maxLength={100}
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
      />
      <p id="transaction-error" className="sheet-error" role="alert">{amountTouched ? amountError : ''}{memo.length > 100 ? ' 메모는 100자까지 입력할 수 있습니다.' : ''}</p>
      <WriteStatus id="transaction-connection" state={state} failure={failure} onReload={ledger.reload} />
      {missing && <p className="sheet-warning" role="alert">이 거래는 서버 목록에 없습니다. 시트를 닫고 처리 결과를 확인해 주세요.</p>}
      <button type="submit" className="sheet-primary" disabled={blocked || missing || confirmDelete || !categoryValid}>{state.saving ? '저장 중…' : transaction ? '변경사항 저장' : '거래 저장'}</button>
      {transaction && !confirmDelete && <button ref={deleteButton} type="button" className="sheet-secondary" disabled={blocked || missing} onClick={() => setConfirmDelete(true)}>거래 삭제</button>}
      {confirmDelete && (
        <section className="sheet-delete-confirm" aria-labelledby="transaction-delete-heading">
          <h3 id="transaction-delete-heading">이 거래를 삭제할까요?</h3>
          <p>삭제한 거래는 복구할 수 없습니다.</p>
          <div className="transaction-confirm-buttons">
            <button ref={deleteCancel} type="button" className="sheet-secondary" onClick={() => { setConfirmDelete(false); requestAnimationFrame(() => deleteButton.current?.focus()) }}>삭제 취소</button>
            <button type="button" className="sheet-primary" disabled={blocked || missing} onClick={remove}>삭제 확인</button>
          </div>
        </section>
      )}
      <button type="button" className="transaction-cancel" onClick={onClose}>취소</button>
      <p className="transaction-footer">캘린더에서 선택한 날짜로 기록합니다.</p>
    </BottomSheet>
  )
}
