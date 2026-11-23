import { useState } from 'react'
import { CategoryEditor, type CategoryEditorTarget } from '../components/CategoryEditor'
import { PageHeader } from '../components/PageHeader'
import { CategoryOrderList } from '../components/CategoryOrderList'
import { ledgerCategories } from '../app/ledgerViews'
import type { LedgerController } from '../state/useLedger'
import type { TransactionType } from '../domain/types'
import { useWriteAction } from '../state/useWriteAction'

export function CategoriesPage({ onBack, ledger }: {
  onBack: () => void
  ledger: LedgerController
}) {
  const [editor, setEditor] = useState<CategoryEditorTarget | null>(null)
  const [draggingType, setDraggingType] = useState<TransactionType | null>(null)
  const { failure, run } = useWriteAction(() => {})
  const { state } = ledger
  const blocked = state.saving || state.status === 'refreshing' || state.needsRefresh || !state.data || !!editor
  const categories = ledger.state.data ? ledgerCategories(ledger.state.data) : []

  return (
    <article className="ledger-page categories-page">
      <button type="button" className="categories-back" aria-label="설정으로 돌아가기" disabled={draggingType !== null} onClick={onBack}>‹ 설정으로</button>
      <PageHeader eyebrow="MY LEDGER" title="카테고리 관리" description="카테고리를 추가하거나 이름을 변경하세요" />
      <p className="settings-note categories-drag-help">오른쪽 핸들을 길게 눌러 위아래로 이동하세요.</p>
      <p className="settings-note categories-move-help">오른쪽 위·아래 버튼으로 순서를 변경하세요.</p>
      {state.saving && <p className="settings-note" role="status">변경사항을 저장 중입니다. 저장이 끝나면 순서가 반영됩니다.</p>}
      {failure && !failure.needsRefresh && <p className="sheet-error" role="alert">{failure.message} 기존에 저장된 순서를 유지했습니다.</p>}
      <div className="categories-workspace">
        {(['expense', 'income'] as const).map((type) => {
          const label = type === 'expense' ? '지출' : '수입'
          const items = categories.filter((category) => category.type === type)

          return (
            <section key={type} aria-labelledby={`categories-${type}-heading`}>
              <div className="categories-group-heading">
                <h2 id={`categories-${type}-heading`}>{label} 카테고리</h2>
                <button type="button" className="categories-add" disabled={blocked || draggingType !== null} aria-label={`${label} 카테고리 추가`} onClick={() => setEditor({ mode: 'add', type })}>+ 추가</button>
              </div>
              {items.length ? (
                <CategoryOrderList items={items} disabled={blocked || (draggingType !== null && draggingType !== type)}
                  editingDisabled={blocked || draggingType !== null}
                  onEdit={(category) => setEditor({ mode: 'edit', type, category })}
                  onOrder={(categoryIds) => { if (!blocked) void run(() => ledger.updateCategoryOrder({ type, categoryIds })) }}
                  onDraggingChange={(dragging) => setDraggingType(dragging ? type : null)} />
              ) : (
                <div className="ledger-empty categories-empty">
                  서버에 등록된 카테고리가 없습니다.
                </div>
              )}
            </section>
          )
        })}
      </div>
      <p className="settings-note">사용 건수는 전체 서버 거래를 기준으로 합니다. 사용 중인 카테고리는 이름만 변경할 수 있습니다.</p>
      {editor && <CategoryEditor target={editor} ledger={ledger} onClose={() => setEditor(null)} />}
    </article>
  )
}
