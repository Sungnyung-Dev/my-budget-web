const monthFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' })

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function shiftMonth(date: Date, amount: number) {
  // 월말 날짜가 다음 달로 넘어가지 않도록 항상 1일을 기준으로 이동합니다.
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

export function formatMonth(date: Date) {
  return monthFormatter.format(date)
}

export function getCalendarDays(month: Date) {
  const start = startOfMonth(month).getDay()
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cellCount = Math.ceil((start + count) / 7) * 7

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - start + 1
    return day >= 1 && day <= count ? day : null
  })
}
