import { useState } from 'react'
import { AppLayout } from './components/AppLayout'
import { PwaUpdateNotice } from './components/PwaUpdateNotice'
import type { PageId } from './app/navigation'
import { HomePage } from './pages/HomePage'
import { HistoryPage } from './pages/HistoryPage'
import { StatsPage } from './pages/StatsPage'
import { SettingsPage } from './pages/SettingsPage'
import { startOfMonth } from './lib/dates'
import { useLedger } from './state/useLedger'
import { LedgerStatus } from './components/LedgerStatus'
import './App.css'

function App() {
  const { state, reload } = useLedger()
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
      <LedgerStatus state={state} onReload={reload} />
      {state.data && page === 'home' && (
        <HomePage data={state.data} month={month} onMonthChange={changeMonth} onHistory={() => navigate('history')} />
      )}
      {state.data && page === 'history' && (
        <HistoryPage
          data={state.data}
          month={month}
          onMonthChange={changeMonth}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      )}
      {state.data && page === 'stats' && <StatsPage data={state.data} month={month} onMonthChange={changeMonth} />}
      {state.data && page === 'settings' && <SettingsPage data={state.data} refreshing={state.status === 'refreshing'} refreshError={state.error} onReload={reload} />}
      <PwaUpdateNotice />
    </AppLayout>
  )
}

export default App
