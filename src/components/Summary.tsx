import { formatMoney, signedMoney } from '../domain/formatters'
import type { Totals } from '../domain/types'

export function Summary({ variant = 'default', unavailable = false, totals }: {
  variant?: 'default' | 'ledger'
  unavailable?: boolean
  totals?: Totals
}) {
  const ready = !!totals && !unavailable
  const values = ready ? [formatMoney(totals.income), formatMoney(totals.expense), signedMoney(totals.balance)] : ['—', '—', '—']

  return (
    <dl className={`summary-strip ${variant === 'ledger' ? 'is-ledger' : ''}`} aria-label={!ready ? '금액 데이터 미연결' : undefined}>
      {['수입', '지출', '수입 − 지출'].map((label, index) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{values[index]}{variant !== 'ledger' && <span>원</span>}</dd>
        </div>
      ))}
    </dl>
  )
}
