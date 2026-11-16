import { useState } from 'react'
import { CategoryBars } from '../components/CategoryBars'
import { PageHeader } from '../components/PageHeader'
import { PeriodNav } from '../components/PeriodNav'
import { Summary } from '../components/Summary'
import { YearChart } from '../components/YearChart'
import { ledgerPeriod, ledgerYear } from '../app/ledgerViews'
import { formatMoney } from '../domain/formatters'
import type { LedgerData } from '../domain/types'
import './StatsPage.css'

export function StatsPage({ data, month, onMonthChange }: { data: LedgerData; month: Date; onMonthChange: (date: Date) => void }) {
  const [mode, setMode] = useState<'month' | 'year'>('month')
  const { totals, spending, metrics, activeMonths, monthlyAverage } = ledgerPeriod(data, month, mode)
  const info = mode === 'month'
    ? [['지출 건수', `${metrics.count}건`], ['지출한 날짜', `${metrics.days}일`], ['지출일 평균', `${formatMoney(metrics.dailyAverage)}원`]]
    : [['기록된 월', `${activeMonths}개월`], ['기록된 월 평균 지출', `${formatMoney(monthlyAverage)}원`]]

  return (
    <article className="ledger-page stats-page">
      <PageHeader eyebrow="MY LEDGER" title="통계" description="수입과 소비 흐름을 분석하세요" />
      <div className="stats-mode" role="group" aria-label="통계 기간">
        <button type="button" aria-pressed={mode === 'month'} onClick={() => setMode('month')}>월간</button>
        <button type="button" aria-pressed={mode === 'year'} onClick={() => setMode('year')}>연간</button>
      </div>
      <PeriodNav month={month} onChange={onMonthChange} yearOnly={mode === 'year'} variant="ledger" />
      <Summary variant="ledger" totals={totals} />
      <div className="stats-workspace">
        {mode === 'year' ? (
          <YearChart year={month.getFullYear()} initialMonth={month.getMonth() + 1} months={ledgerYear(data, month.getFullYear())} />
        ) : (
          <section aria-labelledby="monthly-category-heading">
            <div className="stats-section-heading">
              <h2 id="monthly-category-heading">카테고리별 지출</h2>
            </div>
            <CategoryBars spending={spending} />
          </section>
        )}
        <div className="stats-details">
          <section aria-labelledby="stats-information-heading">
            <div className="stats-section-heading">
              <h2 id="stats-information-heading">{mode === 'month' ? '이달의 소비 정보' : '연간 요약'}</h2>
            </div>
            <dl className="stats-information">
              {info.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          </section>
          {mode === 'year' && (
            <section aria-labelledby="yearly-category-heading">
              <div className="stats-section-heading"><h2 id="yearly-category-heading">연간 카테고리별 지출</h2></div>
              <CategoryBars spending={spending} />
            </section>
          )}
        </div>
      </div>
    </article>
  )
}
