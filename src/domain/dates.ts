export const pad = (value: number) => String(value).padStart(2, '0')

export const dateKey = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`

export const todayKey = (now = new Date()) =>
  dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())

export function dateParts(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day }
}

export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()

export function weekday(date: string) {
  const { year, month, day } = dateParts(date)
  return '일월화수목금토'[new Date(year, month - 1, day).getDay()]
}

export function shiftMonth(date: string, offset: number) {
  const { year, month, day } = dateParts(date)
  // UTC 변환 없이 이동한 달의 마지막 날짜 안으로 선택일을 조정합니다.
  const next = new Date(year, month - 1 + offset, 1)
  return dateKey(next.getFullYear(), next.getMonth() + 1,
    Math.min(day, daysInMonth(next.getFullYear(), next.getMonth() + 1)))
}

export function isValidDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const { year, month, day } = dateParts(date)
  return year >= 1900 && year <= 9999 && month >= 1 && month <= 12
    && day >= 1 && day <= daysInMonth(year, month)
}
