import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from './BottomSheet'

export type CategoryType = 'expense' | 'income'
export type CategoryListItem = { id: string; type: CategoryType; name: string; usageCount: number }
export type CategoryEditorTarget = { mode: 'add' | 'edit'; type: CategoryType; category?: CategoryListItem }

export function CategoryEditor({ target, categories, onClose }: {
  target: CategoryEditorTarget
  categories?: readonly CategoryListItem[]
  onClose: () => void
}) {
  const deleteButton = useRef<HTMLButtonElement>(null)
  const confirmCancel = useRef<HTMLButtonElement>(null)
  const [name, setName] = useState(target.category?.name ?? '')
  const [touched, setTouched] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const editing = target.mode === 'edit'
  const preview = editing && !target.category
  const uses = target.category?.usageCount
  const trimmed = name.trim()
  const duplicate = categories?.some((category) => category.type === target.type
    && category.id !== target.category?.id && category.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())
  const error = !trimmed || trimmed.length > 20
    ? '카테고리 이름을 1~20자로 입력해 주세요.'
    : duplicate ? '같은 유형에 이미 있는 카테고리 이름입니다.' : ''

  useEffect(() => {
    if (confirm) {
      confirmCancel.current?.focus()
      confirmCancel.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [confirm])

  return (
    <BottomSheet
      title={editing ? '카테고리 수정' : '카테고리 추가'}
      closeLabel="카테고리 입력 취소하고 닫기"
      descriptionId="category-editor-connection"
      onClose={onClose}
      onSubmit={(event) => { event.preventDefault(); setTouched(true) }}
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
      <p id="category-editor-connection" className="sheet-notice">
        {preview ? '수정·삭제 UI 미리보기입니다. 선택된 서버 카테고리는 없습니다.' : '서버 API 연결 전입니다. 입력한 내용은 저장되지 않습니다.'}
      </p>
      <button type="submit" className="sheet-primary" disabled title="서버 연결 후 저장할 수 있습니다.">{editing ? '이름 변경 저장' : '카테고리 추가'}</button>
      {editing && !confirm && (
        <button ref={deleteButton} type="button" className="sheet-secondary" disabled={uses !== undefined && uses > 0} onClick={() => setConfirm(true)}>
          {preview ? '삭제 확인 UI 보기' : '카테고리 삭제'}
        </button>
      )}
      {uses !== undefined && uses > 0 && <p className="sheet-warning">거래 {uses}건에서 사용 중이므로 삭제할 수 없습니다. 이름 변경은 기존 거래에도 적용됩니다.</p>}
      {confirm && (
        <section className="sheet-delete-confirm" aria-labelledby="category-delete-heading">
          <h3 id="category-delete-heading">이 카테고리를 삭제할까요?</h3>
          <p>서버 미연결 상태이므로 삭제할 수 없습니다.</p>
          <button type="button" className="sheet-primary" disabled>삭제 확인</button>
          <button ref={confirmCancel} type="button" className="sheet-secondary" onClick={() => { setConfirm(false); requestAnimationFrame(() => deleteButton.current?.focus()) }}>삭제 취소</button>
        </section>
      )}
      <button type="button" className="sheet-secondary" onClick={onClose}>취소</button>
    </BottomSheet>
  )
}
