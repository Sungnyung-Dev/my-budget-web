import { formatMonth, shiftMonth, startOfMonth } from '../lib/dates'
import { Icon } from './Icon'

export function PeriodNav({ month, onChange, yearOnly = false, variant = 'default' }: {
  month: Date
  onChange: (month: Date) => void
  yearOnly?: boolean
  variant?: 'default' | 'ledger'
}) {
  const current = startOfMonth(new Date())
  const isCurrent = month.getFullYear() === current.getFullYear()
    && (yearOnly || month.getMonth() === current.getMonth())
  const period = yearOnly ? '연도' : variant === 'ledger' ? '월' : '달'

  return (
    <div className={`period-toolbar ${variant === 'ledger' ? 'is-ledger' : ''}`}>
      <div className="period-nav" aria-label={yearOnly ? '연도 선택' : '월 선택'}>
        <button
          type="button"
          className="icon-button"
          aria-label={`이전 ${period}`}
          disabled={month.getFullYear() <= 1900 && (yearOnly || month.getMonth() === 0)}
          onClick={() => onChange(shiftMonth(month, yearOnly ? -12 : -1))}
        >{variant === 'ledger' ? <span className="ledger-chevron" aria-hidden="true">‹</span> : <Icon name="arrowLeft" size={18} />}</button>
        <p className="period-label" aria-live="polite">{yearOnly ? `${month.getFullYear()}년` : formatMonth(month)}</p>
        <button
          type="button"
          className="icon-button"
          aria-label={`다음 ${period}`}
          disabled={month.getFullYear() >= 9999 && (yearOnly || month.getMonth() === 11)}
          onClick={() => onChange(shiftMonth(month, yearOnly ? 12 : 1))}
        >{variant === 'ledger' ? <span className="ledger-chevron" aria-hidden="true">›</span> : <Icon name="arrowRight" size={18} />}</button>
      </div>
      {variant !== 'ledger' && <button
        type="button"
        className="text-button period-today"
        disabled={isCurrent}
        onClick={() => onChange(current)}
      >{yearOnly ? '올해' : '이번 달'}</button>}
    </div>
  )
}
