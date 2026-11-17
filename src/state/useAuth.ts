import { useEffect, useState, useSyncExternalStore } from 'react'
import { createAuthStore } from './authStore.ts'
export function useAuth() {
  const [store] = useState(createAuthStore)
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    const stop = store.start()
    const visibility = () => { if (document.hidden) store.suspend(); else void store.check() }
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) void store.check() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pageshow', pageshow)
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pageshow', pageshow); stop() }
  }, [store])
  return { state, check: store.check, login: store.login, logout: store.logout }
}
