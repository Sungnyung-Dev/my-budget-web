import { useState } from 'react'
import { CategoryEditor, type CategoryEditorTarget, type CategoryListItem, type CategoryType } from '../components/CategoryEditor'
import { PageHeader } from '../components/PageHeader'

export function CategoriesPage({ onBack, categories }: {
  onBack: () => void
  categories?: readonly CategoryListItem[]
}) {
  const [editor, setEditor] = useState<CategoryEditorTarget | null>(null)

  return (
    <article className="ledger-page categories-page">
      <button type="button" className="categories-back" aria-label="설정으로 돌아가기" onClick={onBack}>‹ 설정으로</button>
      <PageHeader eyebrow="MY LEDGER" title="카테고리 관리" description="카테고리를 추가하거나 이름을 변경하세요" />
      <div className="categories-workspace">
        {(['expense', 'income'] as const).map((type: CategoryType) => {
          const label = type === 'expense' ? '지출' : '수입'
          const items = categories?.filter((category) => category.type === type)

          return (
            <section key={type} aria-labelledby={`categories-${type}-heading`}>
              <div className="categories-group-heading">
                <h2 id={`categories-${type}-heading`}>{label} 카테고리</h2>
                <button type="button" className="categories-add" aria-label={`${label} 카테고리 추가`} onClick={() => setEditor({ mode: 'add', type })}>+ 추가</button>
              </div>
              {items?.length ? (
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
                  {categories ? '서버에 등록된 카테고리가 없습니다.' : '카테고리 데이터가 연결되지 않았습니다.'}
                  {!categories && <>
                    <br />서버 연결 후 목록을 표시합니다.
                    <button type="button" className="categories-preview" aria-label={`${label} 카테고리 수정·삭제 UI 미리보기`} onClick={() => setEditor({ mode: 'edit', type })}>수정·삭제 UI 미리보기 ›</button>
                  </>}
                </div>
              )}
            </section>
          )
        })}
      </div>
      <p className="settings-note">사용 건수는 전체 서버 거래를 기준으로 합니다. 현재는 읽기 전용이며 입력 시트의 내용은 저장·삭제되지 않습니다.</p>
      {editor && <CategoryEditor target={editor} categories={categories} onClose={() => setEditor(null)} />}
    </article>
  )
}
