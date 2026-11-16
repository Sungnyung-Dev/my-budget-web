export const MAX_AMOUNT = 999_999_999_999

export function parseAmount(value: string) {
  const trimmed = value.trim()
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(trimmed)) {
    throw new Error('금액은 소수점 없이 원 단위 정수로 입력해 주세요.')
  }
  const amount = Number(trimmed.replace(/,/g, ''))
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    throw new Error('금액은 1원부터 999,999,999,999원까지 입력할 수 있습니다.')
  }
  return amount
}

export function sumAmounts(amounts: Iterable<number>) {
  let total = 0
  for (const amount of amounts) {
    const next = total + amount
    if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(next)) {
      throw new Error('금액 합계를 안전한 정수로 계산할 수 없습니다.')
    }
    total = next
  }
  return total
}
