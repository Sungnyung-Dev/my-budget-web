export function Summary({ variant = 'default' }: { variant?: 'default' | 'ledger' }) {
  const value = variant === 'ledger' ? '0' : '—'

  return (
    <dl className={`summary-strip ${variant === 'ledger' ? 'is-ledger' : ''}`}>
      {['수입', '지출', '수입 − 지출'].map((label) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}{variant !== 'ledger' && <span>원</span>}</dd>
        </div>
      ))}
    </dl>
  )
}
