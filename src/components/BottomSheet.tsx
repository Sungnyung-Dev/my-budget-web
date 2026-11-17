import { useEffect, useId, useRef, type FormEventHandler, type ReactNode } from 'react'
import './BottomSheet.css'

export function BottomSheet({ id, title, closeLabel, descriptionId, busy = false, onClose, onSubmit, children }: {
  id?: string
  title: string
  closeLabel: string
  descriptionId: string
  busy?: boolean
  onClose: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (!element.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      element.showModal()
    }
    const viewport = window.visualViewport
    function resize() {
      if (!viewport || !element) return
      // 키보드 위에 시트를 놓고, 남은 화면 안에서 본문을 스크롤합니다.
      const bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      element.style.setProperty('--sheet-keyboard-bottom', `${bottom}px`)
      element.style.setProperty('--sheet-viewport-height', `${viewport.height}px`)
    }
    resize()
    viewport?.addEventListener('resize', resize)
    viewport?.addEventListener('scroll', resize)
    return () => {
      viewport?.removeEventListener('resize', resize)
      viewport?.removeEventListener('scroll', resize)
      requestAnimationFrame(() => {
        if (!element.isConnected && opener.current?.isConnected) opener.current.focus({ preventScroll: true })
      })
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      id={id}
      className="bottom-sheet"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={() => { if (!busy) onClose() }}
      onCancel={(event) => { if (busy) event.preventDefault() }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        const outside = event.clientX < rect.left || event.clientX > rect.right
          || event.clientY < rect.top || event.clientY > rect.bottom
        if (outside && !busy) event.currentTarget.close()
      }}
    >
      <div className="bottom-sheet-header">
        <div className="bottom-sheet-grab" />
        <div className="bottom-sheet-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="bottom-sheet-close" aria-label={closeLabel} disabled={busy} onClick={() => dialog.current?.close()}>×</button>
        </div>
      </div>
      <form className="bottom-sheet-body" noValidate aria-busy={busy} onSubmit={(event) => {
        if (busy) event.preventDefault()
        else onSubmit(event)
      }}><fieldset className="sheet-fields" disabled={busy}>{children}</fieldset></form>
    </dialog>
  )
}
