import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'

export function SettingsPage() {
  return (
    <>
      <PageHeader title="설정" description="나의 가계부를 더 편안하게 사용하세요." />
      <div className="content-grid settings-sections">
        <div>
          <section className="content-section">
            <div className="section-heading"><h2>기본 설정</h2></div>
            <dl className="detail-list">
              <div><dt>통화 단위</dt><dd>대한민국 원 (KRW)</dd></div>
              <div><dt>날짜 형식</dt><dd>YYYY-MM-DD</dd></div>
              <div><dt>화면 스타일</dt><dd>라이트 · 흑백</dd></div>
            </dl>
          </section>
          <section className="content-section">
            <div className="section-heading"><h2>가계부 관리</h2></div>
            <dl className="detail-list">
              <div><dt>가계부 연결</dt><dd className="status-label">연결 전</dd></div>
              <div><dt>카테고리 관리</dt><dd className="muted">준비 중</dd></div>
            </dl>
          </section>
        </div>
        <section className="install-card" aria-labelledby="install-heading">
          <span className="install-icon"><Icon name="book" size={28} /></span>
          <p className="eyebrow">언제나 가까이에</p>
          <h2 id="install-heading">홈 화면에서 만나요</h2>
          <p>앱처럼 간편하게,<br />나의 가계부를 바로 열어보세요.</p>
          <ol className="install-steps">
            <li><span>1</span><p>iPhone의 <strong>Safari</strong>에서 열기</p></li>
            <li><span>2</span><p><strong>공유</strong> <Icon name="share" size={15} /> 메뉴 누르기</p></li>
            <li><span>3</span><p><strong>홈 화면에 추가</strong> 선택하기</p></li>
          </ol>
          <p className="install-desktop-note">PC에서는 지원 브라우저의 설치 메뉴를 이용할 수 있어요.</p>
        </section>
      </div>
      <section className="app-info">
        <span className="brand-mark small"><Icon name="book" size={18} /></span>
        <div><strong>나의 가계부</strong><p>웹 미리보기 · 0.0.0</p></div>
        <Icon name="check" size={17} />
      </section>
    </>
  )
}
