import { PAGINATION } from '../config/constants';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Extract and sanitize pagination query parameters
 */
export const getPaginationParams = (query: Record<string, any> = {}): PaginationParams => {
  let page = parseInt(String(query.page), 10);
  let limit = parseInt(String(query.limit), 10);

  if (isNaN(page) || page < 1) page = PAGINATION.DEFAULT_PAGE;
  if (isNaN(limit) || limit < 1) limit = PAGINATION.DEFAULT_LIMIT;
  if (limit > PAGINATION.MAX_LIMIT) limit = PAGINATION.MAX_LIMIT;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Build pagination metadata object
 */
export const formatPaginationMetadata = (
  totalItems: number,
  page: number,
  limit: number
): PaginationMetadata => {
  const totalPages = Math.ceil(totalItems / limit) || 1;
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

export default {
  getPaginationParams,
  formatPaginationMetadata,
};
