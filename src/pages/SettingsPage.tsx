import { useLayoutEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { CategoriesPage } from './CategoriesPage'
import type { LedgerData } from '../domain/types'
import { ledgerCategories } from '../app/ledgerViews'
import './SettingsPage.css'

export function SettingsPage({ data, refreshing, refreshError, onReload }: {
  data: LedgerData
  refreshing: boolean
  refreshError: string | null
  onReload: () => Promise<boolean>
}) {
  const [view, setView] = useState<'settings' | 'categories'>('settings')

  useLayoutEffect(() => {
    const main = document.getElementById('main-content')
    main?.scrollTo({ top: 0, behavior: 'instant' })
    main?.focus({ preventScroll: true })
  }, [view])

  if (view === 'categories') return <CategoriesPage categories={ledgerCategories(data)} onBack={() => setView('settings')} />

  return (
    <article className="ledger-page settings-page">
      <PageHeader eyebrow="MY LEDGER" title="설정" description="가계부를 내 방식대로 관리하세요" />
      <div className="settings-workspace">
        <div>
          <section aria-labelledby="settings-management-heading">
            <h2 id="settings-management-heading" className="settings-label">관리</h2>
            <button type="button" className="settings-row" onClick={() => setView('categories')}>
              <span>카테고리 관리</span><span className="settings-arrow" aria-hidden="true">›</span>
            </button>
          </section>
          <section aria-labelledby="settings-default-heading">
            <h2 id="settings-default-heading" className="settings-label">기본 설정</h2>
            <dl className="settings-values">
              <div className="settings-row"><dt>통화 단위</dt><dd>대한민국 원 (KRW)</dd></div>
              <div className="settings-row"><dt>날짜 형식</dt><dd>YYYY-MM-DD</dd></div>
            </dl>
          </section>
        </div>
        <div>
          <section aria-labelledby="settings-data-heading">
            <h2 id="settings-data-heading" className="settings-label">데이터</h2>
            <dl className="settings-values">
              <div className="settings-row"><dt>저장 방식</dt><dd>서버 데이터 · 읽기 전용</dd></div>
            </dl>
            <button type="button" className="settings-row" disabled={refreshing} onClick={() => void onReload()} aria-describedby="settings-connection-note">
              <span>서버 데이터 새로고침</span><span className="settings-value">{refreshing ? '조회 중…' : refreshError ? '다시 시도' : '조회 완료'}</span>
            </button>
          </section>
          <section aria-labelledby="settings-info-heading">
            <h2 id="settings-info-heading" className="settings-label">정보</h2>
            <dl className="settings-values">
              <div className="settings-row"><dt>앱 버전</dt><dd>0.0.0 · 웹 미리보기</dd></div>
            </dl>
            <p id="settings-connection-note" className="settings-note">
              서버에서 불러온 데이터를 표시합니다. 새로고침은 조회만 수행하며 거래·카테고리 저장·삭제는 지원하지 않습니다.
            </p>
          </section>
        </div>
      </div>
    </article>
  )
}
