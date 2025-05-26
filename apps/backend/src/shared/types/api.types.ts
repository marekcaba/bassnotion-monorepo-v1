/**
 * Base API response types for consistent response structure across the application
 */

/**
 * Generic success response type
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
}

/**
 * Generic error response type
 */
export interface ApiErrorDetails {
  code: string;
  details?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error: ApiErrorDetails;
}

/**
 * Combined API response type
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Paginated success response type
 */
export interface PaginatedSuccessResponse<T> extends ApiSuccessResponse<T[]> {
  meta: PaginationMeta;
}

/**
 * Combined paginated response type
 */
export type PaginatedResponse<T> =
  | PaginatedSuccessResponse<T>
  | ApiErrorResponse;

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort parameters
 */
export interface SortParams {
  field: string;
  direction: SortDirection;
}

/**
 * Filter operator
 */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'nin';

/**
 * Filter condition
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Query parameters
 */
export interface QueryParams {
  pagination?: PaginationParams;
  sort?: SortParams[];
  filters?: FilterCondition[];
}

/**
 * Type guard for success responses
 */
export function isApiSuccessResponse<T>(
  response: ApiResponse<T>,
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard for error responses
 */
export function isApiErrorResponse(
  response: ApiResponse<unknown>,
): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Type guard for paginated success responses
 */
export const isPaginatedSuccessResponse = <T>(
  response: PaginatedResponse<T>,
): response is PaginatedSuccessResponse<T> => {
  return response.success === true && 'meta' in response;
};
