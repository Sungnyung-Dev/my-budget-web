import { useState } from 'react'
import { CategoryBars } from '../components/CategoryBars'
import { PageHeader } from '../components/PageHeader'
import { PeriodNav } from '../components/PeriodNav'
import { Summary } from '../components/Summary'
import { YearChart } from '../components/YearChart'
import './StatsPage.css'

export function StatsPage({ month, onMonthChange }: { month: Date; onMonthChange: (date: Date) => void }) {
  const [mode, setMode] = useState<'month' | 'year'>('month')

  return (
    <article className="ledger-page stats-page">
      <PageHeader eyebrow="MY LEDGER" title="통계" description="수입과 소비 흐름을 분석하세요" />
      <div className="stats-mode" role="group" aria-label="통계 기간">
        <button type="button" aria-pressed={mode === 'month'} onClick={() => setMode('month')}>월간</button>
        <button type="button" aria-pressed={mode === 'year'} onClick={() => setMode('year')}>연간</button>
      </div>
      <PeriodNav month={month} onChange={onMonthChange} yearOnly={mode === 'year'} variant="ledger" />
      <Summary variant="ledger" unavailable />
      <div className="stats-workspace">
        {mode === 'year' ? (
          <YearChart year={month.getFullYear()} initialMonth={month.getMonth() + 1} />
        ) : (
          <section aria-labelledby="monthly-category-heading">
            <div className="stats-section-heading">
              <h2 id="monthly-category-heading">카테고리별 지출</h2>
              <span className="stats-connection-state">데이터 미연결</span>
            </div>
            <CategoryBars />
          </section>
        )}
        <div className="stats-details">
          <section aria-labelledby="stats-information-heading">
            <div className="stats-section-heading">
              <h2 id="stats-information-heading">{mode === 'month' ? '이달의 소비 정보' : '연간 요약'}</h2>
            </div>
            <dl className="stats-information" aria-label="통계 데이터 미연결">
              {(mode === 'month'
                ? ['지출 건수', '지출한 날짜', '지출일 평균']
                : ['기록된 월', '기록된 월 평균 지출']
              ).map((label) => <div key={label}><dt>{label}</dt><dd>—</dd></div>)}
            </dl>
          </section>
          {mode === 'year' && (
            <section aria-labelledby="yearly-category-heading">
              <div className="stats-section-heading"><h2 id="yearly-category-heading">연간 카테고리별 지출</h2></div>
              <CategoryBars />
            </section>
          )}
        </div>
      </div>
    </article>
  )
}
