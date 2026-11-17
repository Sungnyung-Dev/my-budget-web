import { useEffect, useState, useSyncExternalStore } from 'react'
import { createLedgerStore } from './ledgerStore.ts'

export function useLedger() {
  const [store] = useState(createLedgerStore)
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => store.start(), [store])
  return {
    state, reload: store.reload,
    createTransaction: store.createTransaction, updateTransaction: store.updateTransaction, deleteTransaction: store.deleteTransaction,
    createCategory: store.createCategory, updateCategory: store.updateCategory, deleteCategory: store.deleteCategory,
  }
}
