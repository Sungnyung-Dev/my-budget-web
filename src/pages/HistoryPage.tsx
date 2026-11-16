import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PeriodNav } from '../components/PeriodNav'
import { Summary } from '../components/Summary'
import { TransactionEditor } from '../components/TransactionEditor'
import { getCalendarDays } from '../lib/dates'
import './HistoryPage.css'

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

export function HistoryPage({ month, onMonthChange, selectedDay, onSelectDay }: {
  month: Date
  onMonthChange: (month: Date) => void
  selectedDay: number
  onSelectDay: (day: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const today = new Date()
  const year = month.getFullYear()
  const monthNumber = month.getMonth() + 1
  const selectedDate = new Date(year, month.getMonth(), selectedDay)
  const dateKey = `${year}-${String(monthNumber).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
  const days = getCalendarDays(month)

  return (
    <article className="ledger-page history-page">
      <PageHeader
        eyebrow="MY LEDGER"
        title="내역"
        description="달력에서 날짜를 선택해 기록을 확인하세요"
      />
      <div className="history-workspace">
        <section className="history-calendar-column" aria-label="월별 내역">
          <PeriodNav month={month} onChange={onMonthChange} variant="ledger" />
          <Summary variant="ledger" />
          <section className="ledger-calendar" aria-label={`${year}년 ${monthNumber}월 달력`}>
            <div className="ledger-weekdays" aria-hidden="true">
              {weekdays.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="ledger-days">
              {days.map((day, index) => {
                if (day === null) return <span key={`empty-${index}`} />
                const isToday = today.getFullYear() === year
                  && today.getMonth() === month.getMonth() && today.getDate() === day

                return (
                  <button
                    type="button"
                    key={day}
                    className="ledger-day"
                    aria-label={`${year}년 ${monthNumber}월 ${day}일 ${weekdays[index % 7]}요일${isToday ? ', 오늘' : ''}`}
                    aria-pressed={day === selectedDay}
                    aria-current={isToday ? 'date' : undefined}
                    onClick={() => onSelectDay(day)}
                  >
                    <span className="ledger-day-number">{day}</span>
                    <span className="ledger-day-dots" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
            <p className="ledger-calendar-legend">
              <span aria-hidden="true">●</span> 지출 &nbsp; <span aria-hidden="true">●</span> 수입 · 거래가 있는 날짜 표시
            </p>
          </section>
        </section>

        <section className="history-daily-column" aria-labelledby="selected-date-heading">
          <div className="ledger-divider" />
          <div className="ledger-day-heading">
            <div>
              <h2 id="selected-date-heading" aria-live="polite">
                {monthNumber}월 {selectedDay}일 · {weekdays[selectedDate.getDay()]}요일
              </h2>
              <div className="ledger-day-meta"><span>수입 +0</span><span>지출 −0</span></div>
            </div>
            <span className="ledger-count">0건</span>
          </div>
          <div className="ledger-empty">
            선택한 날짜에 거래가 없습니다.<br />
            + 버튼으로 거래 입력 화면을 열 수 있습니다.
          </div>
        </section>
      </div>

      <div className="ledger-fab-position">
        <button
          type="button"
          className="ledger-fab"
          aria-label="선택한 날짜에 거래 추가"
          aria-haspopup="dialog"
          aria-controls={adding ? 'transaction-editor' : undefined}
          onClick={() => setAdding(true)}
        ><span aria-hidden="true">+</span></button>
      </div>

      {adding && <TransactionEditor date={dateKey} onClose={() => setAdding(false)} />}
    </article>
  )
}
