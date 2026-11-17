import type { Transaction, TransactionInput } from '../../domain/types.ts'
import { validateTransaction } from '../../domain/validateLedger.ts'
import { apiClient } from './client.ts'
import type { ApiClient, ApiRequestOptions } from './client.ts'
import { resourcePath, transactionCreateInput, transactionUpdateInput } from './validation.ts'

export type CreateTransactionInput = TransactionInput
export type UpdateTransactionInput = Partial<TransactionInput>
const path = '/api/v1/transactions'

export async function createTransaction(input: CreateTransactionInput, client: ApiClient = apiClient, options?: ApiRequestOptions): Promise<Transaction> {
  return client.post(path, transactionCreateInput(input), validateTransaction, options)
}

export async function updateTransaction(id: string, input: UpdateTransactionInput, client: ApiClient = apiClient, options?: ApiRequestOptions): Promise<Transaction> {
  return client.patch(resourcePath(path, id), transactionUpdateInput(input), (value) => {
    const row = validateTransaction(value)
    if (row.id !== id) throw new Error('Unexpected transaction ID')
    return row
  }, options)
}

export async function deleteTransaction(id: string, client: ApiClient = apiClient, options?: ApiRequestOptions): Promise<void> {
  return client.delete(resourcePath(path, id), options)
}
