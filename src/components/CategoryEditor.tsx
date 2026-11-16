import { useEffect, useRef, useState } from 'react'
import './CategoryEditor.css'

export type CategoryType = 'expense' | 'income'
export type CategoryListItem = { id: string; type: CategoryType; name: string; usageCount: number }
export type CategoryEditorTarget = { mode: 'add' | 'edit'; type: CategoryType; category?: CategoryListItem }

export function CategoryEditor({ target, categories, onClose }: {
  target: CategoryEditorTarget
  categories?: readonly CategoryListItem[]
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
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
    if (!dialog.current?.open) dialog.current?.showModal()
    const viewport = window.visualViewport
    function resize() {
      if (!viewport || !dialog.current) return
      // 모바일 키보드가 차지하는 높이만큼 시트를 올립니다.
      const bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      dialog.current.style.setProperty('--category-keyboard-bottom', `${bottom}px`)
      dialog.current.style.setProperty('--category-viewport-height', `${viewport.height}px`)
    }
    resize()
    viewport?.addEventListener('resize', resize)
    viewport?.addEventListener('scroll', resize)
    return () => {
      viewport?.removeEventListener('resize', resize)
      viewport?.removeEventListener('scroll', resize)
    }
  }, [])

  useEffect(() => {
    if (confirm) {
      confirmCancel.current?.focus()
      confirmCancel.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [confirm])

  function close() {
    dialog.current?.close()
  }

  return (
    <dialog
      ref={dialog}
      className="category-sheet"
      aria-labelledby="category-editor-title"
      aria-describedby="category-editor-connection"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) close() }}
    >
      <div className="category-sheet-header">
        <div className="category-sheet-grab" />
        <div className="category-sheet-heading">
          <h2 id="category-editor-title">{editing ? '카테고리 수정' : '카테고리 추가'}</h2>
          <button type="button" className="category-sheet-close" aria-label="카테고리 입력 취소하고 닫기" onClick={close}>×</button>
        </div>
      </div>
      <form className="category-sheet-body" noValidate onSubmit={(event) => { event.preventDefault(); setTouched(true) }}>
        <p className="category-field-label">유형</p>
        <div className="category-fixed-type">{target.type === 'expense' ? '지출' : '수입'} 카테고리</div>
        <label className="category-field-label" htmlFor="category-name">카테고리 이름</label>
        <input
          id="category-name"
          className="category-name-input"
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
        <p id="category-name-error" className="category-error" role="alert">{touched ? error : ''}</p>
        <p id="category-editor-connection" className="category-connection">
          {preview ? '수정·삭제 UI 미리보기입니다. 선택된 서버 카테고리는 없습니다.' : '서버 API 연결 전입니다. 입력한 내용은 저장되지 않습니다.'}
        </p>
        <button type="submit" className="category-primary" disabled title="서버 연결 후 저장할 수 있습니다.">{editing ? '이름 변경 저장' : '카테고리 추가'}</button>
        {editing && !confirm && (
          <button ref={deleteButton} type="button" className="category-secondary" disabled={uses !== undefined && uses > 0} onClick={() => setConfirm(true)}>
            {preview ? '삭제 확인 UI 보기' : '카테고리 삭제'}
          </button>
        )}
        {uses !== undefined && uses > 0 && <p className="category-warning">거래 {uses}건에서 사용 중이므로 삭제할 수 없습니다. 이름 변경은 기존 거래에도 적용됩니다.</p>}
        {confirm && (
          <section className="category-delete-confirm" aria-labelledby="category-delete-heading">
            <h3 id="category-delete-heading">이 카테고리를 삭제할까요?</h3>
            <p>서버 미연결 상태이므로 삭제할 수 없습니다.</p>
            <button type="button" className="category-primary" disabled>삭제 확인</button>
            <button ref={confirmCancel} type="button" className="category-secondary" onClick={() => { setConfirm(false); requestAnimationFrame(() => deleteButton.current?.focus()) }}>삭제 취소</button>
          </section>
        )}
        <button type="button" className="category-secondary" onClick={close}>취소</button>
      </form>
    </dialog>
  )
}
