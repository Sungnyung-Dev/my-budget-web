export function Summary({ variant = 'default', unavailable = false }: {
  variant?: 'default' | 'ledger'
  unavailable?: boolean
}) {
  const value = !unavailable && variant === 'ledger' ? '0' : '—'

  return (
    <dl className={`summary-strip ${variant === 'ledger' ? 'is-ledger' : ''}`} aria-label={unavailable ? '금액 데이터 미연결' : undefined}>
      {['수입', '지출', '수입 − 지출'].map((label) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}{variant !== 'ledger' && <span>원</span>}</dd>
        </div>
      ))}
    </dl>
  )
}
