import { PageHeader } from '../components/PageHeader'
import { PeriodNav } from '../components/PeriodNav'
import './HomePage.css'

export function HomePage({ month, onMonthChange, onHistory }: {
  month: Date
  onMonthChange: (date: Date) => void
  onHistory: () => void
}) {
  return (
    <article className="ledger-page home-page">
      <PageHeader eyebrow="MY LEDGER" title="홈" description="이번 달 가계부를 한눈에" />
      <div className="home-workspace">
        <section className="home-overview" aria-label="월별 요약, 데이터 미연결">
          <PeriodNav month={month} onChange={onMonthChange} variant="ledger" />
          <section className="home-hero" aria-labelledby="home-expense-heading">
            <h2 id="home-expense-heading" className="home-small">이번 달 지출</h2>
            <p className="home-amount" aria-label="이번 달 지출, 데이터 미연결">₩ —</p>
            <div className="home-balance">
              <span className="home-small">수입 − 지출</span>
              <strong aria-label="수입에서 지출을 뺀 차액, 데이터 미연결">—원</strong>
            </div>
          </section>
          <dl className="home-mini-stats">
            <div>
              <dt className="home-small">이번 달 수입</dt>
              <dd aria-label="이번 달 수입, 데이터 미연결">—원</dd>
            </div>
            <div>
              <dt className="home-small">거래 건수</dt>
              <dd aria-label="거래 건수, 데이터 미연결">—건</dd>
            </div>
          </dl>
        </section>

        <div className="home-details">
          <section aria-labelledby="home-category-heading">
            <div className="home-section-heading">
              <h2 id="home-category-heading">카테고리별 지출</h2>
              <span className="home-connection-state">데이터 미연결</span>
            </div>
            {/* 원본도 지출 데이터가 없으면 막대 대신 빈 상태를 표시합니다. */}
            <div className="ledger-empty">데이터 연결 후 지출 비율을 표시합니다.</div>
          </section>
          <section aria-labelledby="home-recent-heading">
            <div className="home-section-heading">
              <h2 id="home-recent-heading">최근 거래</h2>
              <button type="button" className="home-history-link" aria-label="전체 내역 보기" onClick={onHistory}>
                전체 보기 <span aria-hidden="true">›</span>
              </button>
            </div>
            <div className="ledger-empty">데이터 연결 후 최근 거래를 표시합니다.</div>
          </section>
        </div>
      </div>
    </article>
  )
}
