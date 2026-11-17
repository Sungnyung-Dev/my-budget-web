import { useEffect, useRef, useState } from 'react'
import type { WriteFailure, WriteResult } from './ledgerStore.ts'

export function useWriteAction(onSuccess: () => void) {
  const [failure, setFailure] = useState<WriteFailure | null>(null)
  const pending = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function run<T>(action: () => Promise<WriteResult<T>>) {
    // React가 비활성 상태를 그리기 전의 연속 submit도 한 번만 처리합니다.
    if (pending.current) return
    pending.current = true
    setFailure(null)
    try {
      const result = await action()
      if (!mounted.current) return
      if (result.ok) onSuccess()
      else setFailure(result)
    } finally {
      pending.current = false
    }
  }

  return { failure, run }
}
