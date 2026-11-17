import { useState } from 'react'
import { CategoryEditor, type CategoryEditorTarget } from '../components/CategoryEditor'
import { PageHeader } from '../components/PageHeader'
import { ledgerCategories } from '../app/ledgerViews'
import type { LedgerController } from '../state/useLedger'

export function CategoriesPage({ onBack, ledger }: {
  onBack: () => void
  ledger: LedgerController
}) {
  const [editor, setEditor] = useState<CategoryEditorTarget | null>(null)
  const categories = ledger.state.data ? ledgerCategories(ledger.state.data) : []

  return (
    <article className="ledger-page categories-page">
      <button type="button" className="categories-back" aria-label="설정으로 돌아가기" onClick={onBack}>‹ 설정으로</button>
      <PageHeader eyebrow="MY LEDGER" title="카테고리 관리" description="카테고리를 추가하거나 이름을 변경하세요" />
      <div className="categories-workspace">
        {(['expense', 'income'] as const).map((type) => {
          const label = type === 'expense' ? '지출' : '수입'
          const items = categories.filter((category) => category.type === type)

          return (
            <section key={type} aria-labelledby={`categories-${type}-heading`}>
              <div className="categories-group-heading">
                <h2 id={`categories-${type}-heading`}>{label} 카테고리</h2>
                <button type="button" className="categories-add" aria-label={`${label} 카테고리 추가`} onClick={() => setEditor({ mode: 'add', type })}>+ 추가</button>
              </div>
              {items.length ? (
                <ul className="categories-list">
                  {items.map((category) => (
                    <li key={category.id}>
                      <button type="button" className="categories-row" aria-label={`${category.name}, 카테고리 수정`} onClick={() => setEditor({ mode: 'edit', type, category })}>
                        <span><span className="categories-name">{category.name}</span><span className="categories-count">{category.usageCount}건 사용</span></span>
                        <span className="settings-arrow" aria-hidden="true">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
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
