import type { ReactNode } from 'react'
import { navigation, type PageId } from '../app/navigation'
import { Icon } from './Icon'
import './ledger.css'

export function AppLayout({ page, onNavigate, children }: {
  page: PageId
  onNavigate: (page: PageId) => void
  children: ReactNode
}) {
  return (
    <div className={`app-layout ledger-layout ${page}-layout`}>
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => { event.preventDefault(); onNavigate('home') }}
          aria-label="나의 가계부 홈"
        >
          <span className="brand-mark"><Icon name="book" size={23} /></span>
          <span>나의 가계부<span className="brand-caption">MY PERSONAL LEDGER</span></span>
        </a>
        <p className="nav-caption">나의 기록</p>
        <nav className="desktop-nav" aria-label="주 메뉴">
          {navigation.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`nav-item ${page === item.id ? 'is-active' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon name={item.icon} /><span>{item.label}</span>
              {page === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="little-rule" />
          <p>차곡차곡 기록하는<br />나의 일상, 나의 가계부.</p>
          <span>작은 기록이 만드는 변화</span>
        </div>
      </aside>

      <div className="main-shell">
        <div className="desktop-topbar"><span>나의 가계부</span><span>매일의 기록, 한눈에.</span></div>
        <main id="main-content" tabIndex={-1} className="main-content">{children}</main>
        <footer className="page-footer"><span>나의 가계부</span><span>나를 위한 작은 기록장</span></footer>
      </div>

      <nav className="bottom-nav" aria-label="하단 메뉴">
        {navigation.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`bottom-nav-item ${page === item.id ? 'is-active' : ''}`}
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} size={21} /><span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
