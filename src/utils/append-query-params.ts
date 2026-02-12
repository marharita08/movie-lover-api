import { toSnakeCase } from './to-snake-case';

export const appendQueryParams = <T extends object>(url: URL, query: T) => {
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    const snakeKey = toSnakeCase(key);

    if (Array.isArray(value)) {
      url.searchParams.set(snakeKey, value.join(','));
    } else {
      url.searchParams.set(snakeKey, value as string);
    }
  });
};
