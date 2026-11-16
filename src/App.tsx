import { useState } from 'react'
import { AppLayout } from './components/AppLayout'
import { PwaUpdateNotice } from './components/PwaUpdateNotice'
import type { PageId } from './app/navigation'
import { HomePage } from './pages/HomePage'
import { HistoryPage } from './pages/HistoryPage'
import { StatsPage } from './pages/StatsPage'
import { SettingsPage } from './pages/SettingsPage'
import { startOfMonth } from './lib/dates'
import './App.css'

function App() {
  const [page, setPage] = useState<PageId>('home')
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())

  function changeMonth(next: Date) {
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    setMonth(next)
    // 31일에서 짧은 달로 이동하면 유효한 마지막 날짜를 선택합니다.
    setSelectedDay((day) => Math.min(day, lastDay))
  }

  function navigate(next: PageId) {
    if (next === page) return
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
    const main = document.getElementById('main-content')
    main?.scrollTo({ top: 0, behavior: 'instant' })
    main?.focus({ preventScroll: true })
  }

  return (
    <AppLayout page={page} onNavigate={navigate}>
      {page === 'home' && (
        <HomePage month={month} onMonthChange={changeMonth} onHistory={() => navigate('history')} />
      )}
      {page === 'history' && (
        <HistoryPage
          month={month}
          onMonthChange={changeMonth}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      )}
      {page === 'stats' && <StatsPage month={month} onMonthChange={changeMonth} />}
      {page === 'settings' && <SettingsPage />}
      <PwaUpdateNotice />
    </AppLayout>
  )
}

export default App
