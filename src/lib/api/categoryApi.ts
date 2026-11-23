import type { Category, TransactionType } from '../../domain/types.ts'
import { validateCategories, validateCategory } from '../../domain/validateLedger.ts'
import { apiClient } from './client.ts'
import type { ApiClient, ApiRequestOptions } from './client.ts'
import { categoryCreateInput, categoryOrderInput, categoryUpdateInput, resourcePath } from './validation.ts'

export type CreateCategoryInput = Omit<Category, 'id' | 'sortOrder'>
export type UpdateCategoryInput = Pick<Category, 'name'>
export type UpdateCategoryOrderInput = { type: TransactionType; categoryIds: string[] }
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

export async function updateCategoryOrder(input: UpdateCategoryOrderInput, client: ApiClient = apiClient, options?: ApiRequestOptions): Promise<Category[]> {
  const body = categoryOrderInput(input)
  return client.put(`${path}/order`, body, (value) => {
    const categories = validateCategories(value)
    if (categories.length !== body.categoryIds.length || categories.some((category, index) =>
      category.type !== body.type || category.id !== body.categoryIds[index]
      || (index > 0 && category.sortOrder <= categories[index - 1].sortOrder))) {
      throw new Error('Unexpected category order')
    }
    return categories
  }, options)
}
