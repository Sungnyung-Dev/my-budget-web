import type { LedgerData } from '../../domain/types.ts'
import { validateLedger } from '../../domain/validateLedger.ts'
import { apiClient } from './client.ts'
import type { ApiClient, ApiRequestOptions } from './client.ts'

export function getLedger(client: ApiClient = apiClient, options?: ApiRequestOptions): Promise<LedgerData> {
  return client.get('/api/v1/ledger', validateLedger, options)
}
