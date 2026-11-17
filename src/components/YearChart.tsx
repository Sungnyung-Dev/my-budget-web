import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { formatMoney } from '../domain/formatters'
import './YearChart.css'

export type YearChartMonth = {
  month: number
  income: number
  expense: number
  count: number
}

const monthStep = 82
const canvasWidth = monthStep * 12
const baseline = 165
const plotHeight = 150

export function YearChart({ year, initialMonth, months }: {
  year: number
  initialMonth: number
  months?: readonly YearChartMonth[]
}) {
  const scroll = useRef<HTMLDivElement>(null)
  const previousYear = useRef<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [edges, setEdges] = useState({ start: true, end: false })
  const values = Array.from({ length: 12 }, (_, index) => months?.find((value) => value.month === index + 1))
  const maximum = Math.max(1, ...values.flatMap((value) => value ? [value.income, value.expense] : []))
  const y = (amount: number) => baseline - amount / maximum * plotHeight
  const incomePoints = values.flatMap((value, index) => value?.count
    ? [{ x: index * monthStep + 40, y: y(value.income) }]
    : [])

  const updateEdges = useCallback(() => {
    const element = scroll.current
    if (!element) return
    const next = { start: element.scrollLeft <= 1, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1 }
    setEdges((current) => current.start === next.start && current.end === next.end ? current : next)
  }, [])

  useLayoutEffect(() => {
    const element = scroll.current
    if (!element) return
    // 처음에는 선택 월 주변을, 연도 변경 뒤에는 1월부터 보여줍니다.
    if (previousYear.current === null) element.scrollLeft = Math.max(0, initialMonth - 4) * monthStep
    else if (previousYear.current !== year) element.scrollLeft = 0
    previousYear.current = year
    const observer = new ResizeObserver(updateEdges)
    observer.observe(element)
    return () => observer.disconnect()
  }, [year, initialMonth, updateEdges])

  function move(delta: number) {
    scroll.current?.scrollBy({
      left: delta * monthStep * 3,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  return (
    <section className="year-chart" aria-labelledby="year-chart-heading">
      <div className="stats-section-heading">
        <h2 id="year-chart-heading">월별 수입·지출 추이</h2>
        {!months && <span className="stats-connection-state">데이터 미연결</span>}
      </div>
      <div className="year-chart-legend">
        <span><i className="year-legend-bar" aria-hidden="true" />지출 · 막대</span>
        <span><i className="year-legend-line" aria-hidden="true" />수입 · 선</span>
      </div>
      <div className="year-chart-wrap">
        <div
          ref={scroll}
          className="year-chart-scroll"
          role="region"
          aria-label={`${year}년 수입·지출 차트, 좌우로 월 이동${months ? '' : ', 데이터 미연결'}`}
          tabIndex={0}
          onScroll={updateEdges}
        >
          <div className="year-chart-canvas" style={{ width: canvasWidth }}>
            <svg viewBox={`0 0 ${canvasWidth} 171`} width={canvasWidth} height="171" aria-hidden="true">
              {[15, 65, 115, 165].map((lineY) => <line key={lineY} x1="0" x2={canvasWidth} y1={lineY} y2={lineY} stroke="#ececec" />)}
              {values.map((value, index) => value?.count ? (
                <rect key={index} x={index * monthStep + 26} y={y(value.expense)} width="28" height={value.expense / maximum * plotHeight} rx="4" fill="#a5a5a5" />
              ) : null)}
              {incomePoints.length > 0 && <>
                <polyline points={incomePoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#181818" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
                {incomePoints.map((point) => <circle key={point.x} cx={point.x} cy={point.y} r="3.5" fill="#fff" stroke="#181818" strokeWidth="2" />)}
              </>}
            </svg>
            {values.map((value, index) => (
              <button
                type="button"
                key={index}
                className={`year-chart-month ${value?.count ? '' : 'is-missing'}`}
                style={{ left: index * monthStep }}
                aria-pressed={selectedMonth === index + 1}
                aria-label={`${index + 1}월, ${!months ? '데이터 미연결' : `수입 ${formatMoney(value?.income ?? 0)}원, 지출 ${formatMoney(value?.expense ?? 0)}원${value?.count ? '' : ', 거래 없음'}`}`}
                onClick={() => setSelectedMonth(index + 1)}
              >{index + 1}월</button>
            ))}
          </div>
        </div>
      </div>
      <div className="year-chart-controls">
        <button type="button" disabled={edges.start} aria-label="차트 이전 3개월" onClick={() => move(-1)}>‹ 이전</button>
        <span>그래프를 좌우로 밀어보세요</span>
        <button type="button" disabled={edges.end} aria-label="차트 다음 3개월" onClick={() => move(1)}>다음 ›</button>
      </div>
      <p className="year-chart-note">선과 막대는 같은 금액 축을 사용합니다. 데이터가 없는 달에는 표시되지 않습니다.</p>
    </section>
  )
}
