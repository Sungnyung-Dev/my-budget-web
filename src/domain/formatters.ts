import { dateParts, weekday } from './dates.ts'

export const formatMoney = (value: number) => Math.abs(value).toLocaleString('ko-KR')

export const signedMoney = (value: number) => `${value < 0 ? '−' : '+'}${formatMoney(value)}`

export function dateLabel(date: string) {
  const { year, month, day } = dateParts(date)
  return `${year}년 ${month}월 ${day}일 ${weekday(date)}요일`
}
