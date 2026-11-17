import { formatMoney, formatNumber } from '../domain/formatters'

export type CategorySpending = {
  id: string
  name: string
  amount: number
  share: number
}

export function CategoryBars({ spending }: { spending?: readonly CategorySpending[] }) {
  if (!spending?.length) {
    return (
      <div className="ledger-empty">
        {spending ? '이 기간의 지출 내역이 없습니다.' : '데이터 연결 후 지출 비율을 표시합니다.'}
      </div>
    )
  }

  return (
    <ul className="category-bars">
      {spending.map((category) => (
        <li key={category.id}>
          <div className="category-bar-text">
            <span>{category.name}</span>
            <strong>{formatMoney(category.amount)}원 · {formatNumber(Math.round(category.share * 100))}%</strong>
          </div>
          <div className="category-bar-track" aria-hidden="true">
            <div style={{ width: `${Math.max(0, Math.min(1, category.share)) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
