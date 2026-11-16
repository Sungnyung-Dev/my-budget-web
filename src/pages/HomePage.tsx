import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { PeriodNav } from '../components/PeriodNav'

export function HomePage({ month, onMonthChange, onHistory }: {
  month: Date
  onMonthChange: (date: Date) => void
  onHistory: () => void
}) {
  return (
    <>
      <PageHeader title="홈" description="이번 달 가계부를 한눈에 살펴보세요." />
      <PeriodNav month={month} onChange={onMonthChange} />
      <div className="overview-grid">
        <section className="expense-card" aria-labelledby="expense-heading">
          <div className="card-label"><h2 id="expense-heading">이번 달 지출</h2><span className="card-symbol"><Icon name="arrowUp" size={18} /></span></div>
          <p className="hero-amount"><span>₩</span> —</p>
          <div className="balance-row"><span>수입 − 지출</span><strong>— 원</strong></div>
        </section>
        <div className="mini-stats">
          <section className="mini-stat"><div className="card-label"><h2>이번 달 수입</h2><Icon name="arrowDown" size={17} /></div><p>—<span>원</span></p></section>
          <section className="mini-stat"><div className="card-label"><h2>거래 건수</h2><Icon name="receipt" size={17} /></div><p>—<span>건</span></p></section>
        </div>
      </div>
      <p className="data-note">아직 가계부를 연결하지 않았어요. 연결 후 나의 기록이 여기에 표시됩니다.</p>
      <div className="content-grid home-sections">
        <section className="content-section">
          <div className="section-heading"><h2>카테고리별 지출</h2><span className="section-meta">이번 달</span></div>
          <div className="empty-panel"><EmptyState icon="circle" title="아직 표시할 지출이 없어요" description="나의 소비가 어디로 향했는지 한눈에 살펴보세요." /></div>
        </section>
        <section className="content-section">
          <div className="section-heading"><h2>최근 거래</h2><button type="button" className="text-button" onClick={onHistory}>전체 보기<Icon name="arrowRight" size={14} /></button></div>
          <div className="empty-panel"><EmptyState title="기록을 기다리고 있어요" description="연결된 가계부의 최근 거래가 여기에 모입니다." /></div>
        </section>
      </div>
      <div className="quiet-note"><Icon name="book" size={18} /><p>작은 기록부터, 나의 생활을 차곡차곡.</p></div>
    </>
  )
}
