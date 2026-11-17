import { useLayoutEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { CategoriesPage } from './CategoriesPage'
import type { LedgerData } from '../domain/types'
import type { LedgerController } from '../state/useLedger'
import { formatNumber } from '../domain/formatters'
import './SettingsPage.css'

export function SettingsPage({ data, ledger, onLogout }: {
  data: LedgerData
  onLogout?: () => Promise<void>
  ledger: LedgerController
}) {
  const [view, setView] = useState<'settings' | 'categories'>('settings')
  const { state, reload } = ledger
  const refreshing = state.status === 'refreshing'

  useLayoutEffect(() => {
    const main = document.getElementById('main-content')
    main?.scrollTo({ top: 0, behavior: 'instant' })
    main?.focus({ preventScroll: true })
  }, [view])

  if (view === 'categories') return <CategoriesPage ledger={ledger} onBack={() => setView('settings')} />

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
              <div className="settings-row"><dt>저장 방식</dt><dd>서버 저장</dd></div>
            </dl>
            <button type="button" className="settings-row" disabled={refreshing || state.saving} onClick={() => void reload()} aria-describedby="settings-connection-note">
              <span>서버 데이터 새로고침</span><span className="settings-value">{refreshing ? '조회 중…' : state.error || state.needsRefresh ? '다시 확인' : '조회 완료'}</span>
            </button>
          </section>
          {onLogout && <section aria-labelledby="settings-auth-heading">
            <h2 id="settings-auth-heading" className="settings-label">로그인</h2>
            <button type="button" className="settings-row" disabled={state.saving} onClick={() => void onLogout()}>
              <span>로그아웃</span><span className="settings-arrow" aria-hidden="true">›</span>
            </button>
          </section>}
          <section aria-labelledby="settings-info-heading">
            <h2 id="settings-info-heading" className="settings-label">정보</h2>
            <dl className="settings-values">
              <div className="settings-row"><dt>앱 버전</dt><dd>0.0.0</dd></div>
            </dl>
            <p id="settings-connection-note" className="settings-note">
              거래 {formatNumber(data.transactions.length)}건 · 카테고리 {formatNumber(data.categories.length)}개를 서버에서 불러왔습니다. 새로고침은 조회만 수행하며, 저장·삭제는 서버 확인 후 화면에 반영합니다.
            </p>
          </section>
        </div>
      </div>
    </article>
  )
}
