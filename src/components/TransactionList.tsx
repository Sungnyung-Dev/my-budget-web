import { dateLabel, signedMoney } from '../domain/formatters'
import type { Category, Transaction } from '../domain/types'
import { Icon } from './Icon'

export function TransactionList({ rows, categories, showDate = false }: {
  rows: readonly Transaction[]
  categories: readonly Category[]
  showDate?: boolean
}) {
  return (
    <ul className="ledger-transactions">
      {rows.map((row) => {
        const category = categories.find((item) => item.id === row.categoryId)
        return (
          <li key={row.id} className="ledger-transaction">
            <span className="ledger-transaction-icon"><Icon name={row.type === 'income' ? 'arrowUp' : 'receipt'} size={18} /></span>
            <div className="ledger-transaction-text">
              <strong>{row.memo || category?.name || '거래'}</strong>
              <span>{category?.name}{showDate && <> · <time dateTime={row.date} title={dateLabel(row.date)}>{row.date.slice(5).replace('-', '.')}</time></>}</span>
            </div>
            <span className="ledger-transaction-amount" aria-label={`${row.type === 'income' ? '수입' : '지출'} 금액`}>
              {signedMoney(row.type === 'income' ? row.amount : -row.amount)}원
            </span>
          </li>
        )
      })}
    </ul>
  )
}
