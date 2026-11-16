import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { PeriodNav } from '../components/PeriodNav'
import { Summary } from '../components/Summary'

export function StatsPage({ month, onMonthChange }: { month: Date; onMonthChange: (date: Date) => void }) {
  const [mode, setMode] = useState<'month' | 'year'>('month')

  return (
    <>
      <PageHeader title="통계" description="수입과 소비의 흐름을 천천히 들여다보세요." />
      <div className="segmented-control" role="group" aria-label="통계 기간">
        <button type="button" aria-pressed={mode === 'month'} onClick={() => setMode('month')}>월간</button>
        <button type="button" aria-pressed={mode === 'year'} onClick={() => setMode('year')}>연간</button>
      </div>
      <PeriodNav month={month} onChange={onMonthChange} yearOnly={mode === 'year'} />
      <Summary />
      <div className="content-grid stats-sections">
        <section className="content-section">
          <div className="section-heading"><h2>{mode === 'month' ? '카테고리별 지출' : '월별 수입·지출 추이'}</h2></div>
          <div className="empty-panel stats-empty"><EmptyState icon="chart" title="나의 소비 흐름이 쌓이는 곳" description="기록이 연결되면 이 기간의 통계를 확인할 수 있어요." /></div>
        </section>
        <section className="content-section">
          <div className="section-heading"><h2>{mode === 'month' ? '이달의 소비 정보' : '연간 요약'}</h2></div>
          <dl className="detail-list">
            {(mode === 'month' ? ['지출 건수', '지출한 날짜', '지출일 평균'] : ['기록된 월', '월 평균 지출', '연간 지출']).map((label) => <div key={label}><dt>{label}</dt><dd>—</dd></div>)}
          </dl>
          <p className="data-note">가계부 연결 후 실제 기록을 기준으로 계산됩니다.</p>
        </section>
      </div>
    </>
  )
}
