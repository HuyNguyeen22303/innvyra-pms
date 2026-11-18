import type { ApiResponse, PaginatedResult } from '../types/api.types.ts';

export async function collectPages<T>(
  fetchPage: (page: number) => Promise<ApiResponse<PaginatedResult<T>>>,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let totalPages: number;
  do {
    signal?.throwIfAborted();
    const { data } = await fetchPage(page);
    signal?.throwIfAborted();
    items.push(...data.items);
    totalPages = data.pagination.totalPages;
    page++;
  } while (page <= totalPages);
  return items;
}
