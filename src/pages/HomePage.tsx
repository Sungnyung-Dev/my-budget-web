import { PageHeader } from '../components/PageHeader'
import { PeriodNav } from '../components/PeriodNav'
import { CategoryBars } from '../components/CategoryBars'
import { TransactionList } from '../components/TransactionList'
import { ledgerPeriod } from '../app/ledgerViews'
import { formatMoney, signedMoney } from '../domain/formatters'
import type { LedgerData, Transaction } from '../domain/types'
import './HomePage.css'

export function HomePage({ data, month, onMonthChange, onHistory, onEdit }: {
  data: LedgerData
  month: Date
  onMonthChange: (date: Date) => void
  onHistory: () => void
  onEdit: (row: Transaction) => void
}) {
  const { rows, totals, spending, recent } = ledgerPeriod(data, month)
  return (
    <article className="ledger-page home-page">
      <PageHeader eyebrow="MY LEDGER" title="홈" description="이번 달 가계부를 한눈에" />
      <div className="home-workspace">
        <section className="home-overview" aria-label="월별 요약">
          <PeriodNav month={month} onChange={onMonthChange} variant="ledger" />
          <section className="home-hero" aria-labelledby="home-expense-heading">
            <h2 id="home-expense-heading" className="home-small">이번 달 지출</h2>
            <p className="home-amount">₩ {formatMoney(totals.expense)}</p>
            <div className="home-balance">
              <span className="home-small">수입 − 지출</span>
              <strong>{signedMoney(totals.balance)}원</strong>
            </div>
          </section>
          <dl className="home-mini-stats">
            <div>
              <dt className="home-small">이번 달 수입</dt>
              <dd>{formatMoney(totals.income)}원</dd>
            </div>
            <div>
              <dt className="home-small">거래 건수</dt>
              <dd>{rows.length}건</dd>
            </div>
          </dl>
        </section>

        <div className="home-details">
          <section aria-labelledby="home-category-heading">
            <div className="home-section-heading">
              <h2 id="home-category-heading">카테고리별 지출</h2>
            </div>
            <CategoryBars spending={spending} />
          </section>
          <section aria-labelledby="home-recent-heading">
            <div className="home-section-heading">
              <h2 id="home-recent-heading">최근 거래</h2>
              <button type="button" className="home-history-link" aria-label="전체 내역 보기" onClick={onHistory}>
                전체 보기 <span aria-hidden="true">›</span>
              </button>
            </div>
            {recent.length ? <TransactionList rows={recent} categories={data.categories} showDate onEdit={onEdit} /> : <div className="ledger-empty">최근 거래가 없습니다.</div>}
          </section>
        </div>
      </div>
    </article>
  )
}
