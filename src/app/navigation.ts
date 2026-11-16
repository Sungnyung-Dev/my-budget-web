import type { IconName } from '../components/Icon'

export type PageId = 'home' | 'history' | 'stats' | 'settings'

export const navigation: { id: PageId; label: string; icon: IconName }[] = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'history', label: '내역', icon: 'calendar' },
  { id: 'stats', label: '통계', icon: 'stats' },
  { id: 'settings', label: '설정', icon: 'settings' },
]
