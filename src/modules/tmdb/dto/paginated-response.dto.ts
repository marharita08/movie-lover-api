export interface PaginatedResponseDto<T> {
  page: number;
  results: T[];
  totalPages: number;
  totalResults: number;
}
