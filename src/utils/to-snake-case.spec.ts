import { toSnakeCase } from './to-snake-case';

describe('toSnakeCase', () => {
  it('should convert camelCase to snake_case', () => {
    const input = 'camelCase';
    const expected = 'camel_case';

    const result = toSnakeCase(input);

    expect(result).toBe(expected);
  });

  it('should not change already snake_case strings', () => {
    const input = 'snake_case';
    const expected = 'snake_case';

    const result = toSnakeCase(input);

    expect(result).toBe(expected);
  });

  it('should not change lowercase strings', () => {
    const input = 'lowercase';
    const expected = 'lowercase';

    const result = toSnakeCase(input);

    expect(result).toBe(expected);
  });

  it('should handle multiple uppercase letters', () => {
    const input = 'someLongCamelCaseString';
    const expected = 'some_long_camel_case_string';

    const result = toSnakeCase(input);

    expect(result).toBe(expected);
  });
});
