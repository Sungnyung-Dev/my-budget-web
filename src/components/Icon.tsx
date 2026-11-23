import type { ReactNode } from 'react'

const paths = {
  book: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v18m4-12h3m-3 4h3" /></>,
  home: <path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
  stats: <path d="M21 12A9 9 0 1 1 12 3v9zM15 3.5A9 9 0 0 1 20.5 9H15z" />,
  chart: <><path d="M4 3v17h17M9 15v-4m5 4V6m5 9V9" /></>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="white" /><circle cx="15" cy="12" r="2" fill="white" /><circle cx="9" cy="18" r="2" fill="white" /></>,
  arrowLeft: <path d="m14 6-6 6 6 6" />,
  arrowRight: <path d="m10 6 6 6-6 6" />,
  arrowDown: <path d="M12 4v16m-6-6 6 6 6-6" />,
  arrowUp: <path d="M12 20V4m-6 6 6-6 6 6" />,
  grip: <><path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01" strokeWidth="3" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Zm3 5h6m-6 4h6" /></>,
  circle: <><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 6" /></>,
  share: <><path d="M12 15V3m-4 4 4-4 4 4M7 10H5v11h14V10h-2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof paths

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
