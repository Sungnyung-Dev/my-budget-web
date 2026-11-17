import type { Category } from '../../domain/types.ts'
import { validateCategory } from '../../domain/validateLedger.ts'
import { apiClient } from './client.ts'
import type { ApiClient, ApiRequestOptions } from './client.ts'
import { categoryCreateInput, categoryUpdateInput, resourcePath } from './validation.ts'

export type CreateCategoryInput = Omit<Category, 'id'>
export type UpdateCategoryInput = Pick<Category, 'name'>
const path = '/api/v1/categories'

export async function createCategory(input: CreateCategoryInput, client: ApiClient = apiClient, options?: ApiRequestOptions): Promise<Category> {
  return client.post(path, categoryCreateInput(input), validateCategory, options)
}

export async function updateCategory(id: string, input: UpdateCategoryInput, client: ApiClient = apiClient, options?: ApiRequestOptions): Promise<Category> {
  return client.patch(resourcePath(path, id), categoryUpdateInput(input), (value) => {
    const category = validateCategory(value)
    if (category.id !== id) throw new Error('Unexpected category ID')
    return category
  }, options)
}

export async function deleteCategory(id: string, client: ApiClient = apiClient, options?: ApiRequestOptions): Promise<void> {
  return client.delete(resourcePath(path, id), options)
}
