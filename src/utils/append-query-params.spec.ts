import { appendQueryParams } from './append-query-params';

describe('appendQueryParams', () => {
  let url: URL;

  beforeEach(() => {
    url = new URL('https://example.com');
  });

  it('should append simple query parameters', () => {
    const query = { page: '1', limit: '10' };

    appendQueryParams(url, query);

    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('should convert keys to snake_case', () => {
    const query = { pageNumber: '1', itemsPerPage: '10' };

    appendQueryParams(url, query);

    expect(url.searchParams.get('page_number')).toBe('1');
    expect(url.searchParams.get('items_per_page')).toBe('10');
  });

  it('should handle array values as comma-separated strings', () => {
    const query = { genres: ['action', 'comedy'] };

    appendQueryParams(url, query);

    expect(url.searchParams.get('genres')).toBe('action,comedy');
  });

  it('should skip null and undefined values', () => {
    const query = { active: true, deleted: null, archived: undefined };

    appendQueryParams(url, query);

    expect(url.searchParams.has('active')).toBe(true);
    expect(url.searchParams.has('deleted')).toBe(false);
    expect(url.searchParams.has('archived')).toBe(false);
  });

  it('should handle numeric values (coerced to string)', () => {
    const query = { id: 123 } as any;

    appendQueryParams(url, query);

    expect(url.searchParams.get('id')).toBe('123');
  });
});
