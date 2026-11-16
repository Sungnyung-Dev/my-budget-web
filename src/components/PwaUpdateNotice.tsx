import { useRegisterSW } from 'virtual:pwa-register/react'
import { Icon } from './Icon'

export function PwaUpdateNotice() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError(error) {
      console.error('앱 화면 캐시를 준비하지 못했습니다.', error)
    },
  })

  if (!needRefresh) return null

  return (
    <aside className="update-notice" aria-label="앱 업데이트" role="status">
      <div><strong>새 버전이 준비되었어요</strong><p>새로고침하면 최신 화면을 사용할 수 있어요.</p></div>
      <button type="button" className="primary-button" onClick={() => void updateServiceWorker(true)}>새로고침</button>
      <button type="button" className="icon-button" aria-label="업데이트 알림 닫기" onClick={() => setNeedRefresh(false)}>
        <Icon name="close" size={18} />
      </button>
    </aside>
  )
}
