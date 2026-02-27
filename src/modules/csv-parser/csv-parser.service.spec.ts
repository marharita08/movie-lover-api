import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToClass } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import * as Papa from 'papaparse';

import { CsvParserService } from './csv-parser.service';

jest.mock('papaparse');
jest.mock('class-transformer');
jest.mock('class-validator');

const mockedPapa = Papa as jest.Mocked<typeof Papa>;
const mockedPlainToClass = plainToClass as jest.MockedFunction<
  typeof plainToClass
>;
const mockedValidate = validate as jest.MockedFunction<typeof validate>;

class TestDto {
  name: string;
  year: string;
}

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CsvParserService],
    }).compile();

    service = module.get(CsvParserService);
  });

  afterEach(() => jest.clearAllMocks());

  const mockPapaComplete = (
    data: unknown[],
    errors: Papa.ParseError[] = [],
  ) => {
    (mockedPapa.parse as jest.Mock).mockImplementation(
      (_input, config: any) => {
        config.complete({ data, errors, meta: {} });
        return {} as Papa.ParseResult<unknown>;
      },
    );
  };

  const mockPapaError = (error: unknown) => {
    (mockedPapa.parse as jest.Mock).mockImplementation(
      (_input, config: any) => {
        config.error(error);
      },
    );
  };

  const createValidationError = (
    property: string,
    constraints: Record<string, string>,
  ): ValidationError => {
    const error = new ValidationError();
    error.property = property;
    error.constraints = constraints;
    return error;
  };

  describe('parse', () => {
    it('should parse valid CSV and return typed rows', async () => {
      const rows = [
        { name: 'Inception', year: '2010' },
        { name: 'Interstellar', year: '2014' },
      ];
      mockPapaComplete(rows);

      const result = await service.parse(
        'name,year\nInception,2010\nInterstellar,2014',
      );

      expect(result).toEqual(rows);
    });

    it('should pass default options to Papa.parse', async () => {
      mockPapaComplete([]);

      await service.parse('');

      expect(mockedPapa.parse).toHaveBeenCalledWith(
        '',
        expect.objectContaining({
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
          dynamicTyping: false,
        }),
      );
    });

    it('should override defaults with provided options', async () => {
      mockPapaComplete([]);

      await service.parse('a;b\n1;2', {
        delimiter: ';',
        header: false,
        dynamicTyping: true,
        skipEmptyLines: false,
      });

      expect(mockedPapa.parse).toHaveBeenCalledWith(
        'a;b\n1;2',
        expect.objectContaining({
          delimiter: ';',
          header: false,
          dynamicTyping: true,
          skipEmptyLines: false,
        }),
      );
    });

    it('should apply transformHeader when provided', async () => {
      mockPapaComplete([]);
      const transformHeader = (h: string) => h.toLowerCase();

      await service.parse('Name,Year\n', { transformHeader });

      expect(mockedPapa.parse).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ transformHeader }),
      );
    });

    it('should throw BadRequestException when CSV has parse errors', async () => {
      const errors: Papa.ParseError[] = [
        {
          type: 'Quotes',
          code: 'MissingQuotes',
          message: 'Missing quotes',
          row: 1,
        },
      ];
      mockPapaComplete([], errors);

      await expect(service.parse('"bad csv')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include errors in the BadRequestException payload', async () => {
      const errors: Papa.ParseError[] = [
        {
          type: 'Quotes',
          code: 'MissingQuotes',
          message: 'Missing quotes',
          row: 1,
        },
      ];
      mockPapaComplete([], errors);

      await expect(service.parse('"bad csv')).rejects.toMatchObject({
        response: {
          message: 'CSV parsing failed',
          errors,
        },
      });
    });

    it('should reject with the original Error when Papa fires error callback', async () => {
      const originalError = new Error('Stream error');
      mockPapaError(originalError);

      await expect(service.parse('')).rejects.toThrow('Stream error');
    });

    it('should wrap a non-Error thrown value in an Error', async () => {
      mockPapaError('something went wrong');

      await expect(service.parse('')).rejects.toThrow('something went wrong');
      await expect(service.parse('')).rejects.toBeInstanceOf(Error);
    });
  });

  describe('parseAndValidate', () => {
    it('should throw BadRequestException if CSV is empty', async () => {
      mockPapaComplete([]);

      await expect(service.parseAndValidate('', TestDto)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.parseAndValidate('', TestDto)).rejects.toThrow(
        'CSV file is empty',
      );
    });

    it('should return validated rows when all rows are valid', async () => {
      const rows = [
        { name: 'Inception', year: '2010' },
        { name: 'Interstellar', year: '2014' },
      ];
      mockPapaComplete(rows);

      const dto1 = { name: 'Inception', year: '2010' };
      const dto2 = { name: 'Interstellar', year: '2014' };
      mockedPlainToClass.mockReturnValueOnce(dto1 as any);
      mockedPlainToClass.mockReturnValueOnce(dto2 as any);
      mockedValidate.mockResolvedValue([]);

      const result = await service.parseAndValidate(
        'name,year\nInception,2010\nInterstellar,2014',
        TestDto,
      );

      expect(result).toHaveLength(2);
      expect(result).toEqual([dto1, dto2]);
      expect(mockedValidate).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException with compact message when some rows fail validation', async () => {
      const rows = [
        { name: 'Inception', year: '2010' },
        { name: '', year: '2014' },
        { name: 'Dunkirk', year: '' },
      ];
      mockPapaComplete(rows);

      mockedPlainToClass.mockImplementation((_, obj) => obj as any);

      mockedValidate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          createValidationError('name', {
            isNotEmpty: 'name should not be empty',
          }),
        ])
        .mockResolvedValueOnce([
          createValidationError('year', {
            isNotEmpty: 'year should not be empty',
          }),
        ]);

      await expect(
        service.parseAndValidate('csv content', TestDto),
      ).rejects.toThrow(
        'Validation failed. Row 2: name should not be empty. Row 3: year should not be empty',
      );
    });

    it('should show "first errors" message when more than 5 rows fail', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        name: '',
        year: `${2010 + i}`,
      }));
      mockPapaComplete(rows);

      mockedPlainToClass.mockImplementation((_, obj) => obj as any);
      mockedValidate.mockResolvedValue([
        createValidationError('name', {
          isNotEmpty: 'name should not be empty',
        }),
      ]);

      await expect(
        service.parseAndValidate('csv content', TestDto),
      ).rejects.toThrow(/Validation failed for 10 rows\. First errors/);

      await expect(
        service.parseAndValidate('csv content', TestDto),
      ).rejects.toThrow(/Please fix the errors and try again/);
    });

    it('should limit error collection to MAX_ERRORS_TO_REPORT (10)', async () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({
        name: '',
        year: `${2010 + i}`,
      }));
      mockPapaComplete(rows);

      mockedPlainToClass.mockImplementation((_, obj) => obj as any);
      mockedValidate.mockResolvedValue([
        createValidationError('name', {
          isNotEmpty: 'name should not be empty',
        }),
      ]);

      try {
        await service.parseAndValidate('csv content', TestDto);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('20 rows');
      }
    });

    it('should show only first 5 errors in message even when 10 are collected', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        name: '',
        year: `${2010 + i}`,
      }));
      mockPapaComplete(rows);

      mockedPlainToClass.mockImplementation((_, obj) => obj as any);
      mockedValidate.mockResolvedValue([
        createValidationError('name', {
          isNotEmpty: 'name should not be empty',
        }),
      ]);

      try {
        await service.parseAndValidate('csv content', TestDto);
      } catch (error) {
        const message = error.message;
        expect(message).toMatch(/Row 1:/);
        expect(message).toMatch(/Row 2:/);
        expect(message).toMatch(/Row 3:/);
        expect(message).toMatch(/Row 4:/);
        expect(message).toMatch(/Row 5:/);
        expect(message).not.toMatch(/Row 6:/);
      }
    });

    it('should pass options to parse method', async () => {
      const rows = [{ name: 'Inception', year: '2010' }];
      mockPapaComplete(rows);

      const dto = { name: 'Inception', year: '2010' };
      mockedPlainToClass.mockReturnValue(dto as any);
      mockedValidate.mockResolvedValue([]);

      await service.parseAndValidate('name;year\nInception;2010', TestDto, {
        delimiter: ';',
      });

      expect(mockedPapa.parse).toHaveBeenCalledWith(
        'name;year\nInception;2010',
        expect.objectContaining({
          delimiter: ';',
        }),
      );
    });

    it('should format multiple constraint errors for a single field', async () => {
      const rows = [{ name: 'X', year: '2010' }];
      mockPapaComplete(rows);

      const dto = { name: 'X', year: '2010' };
      mockedPlainToClass.mockReturnValue(dto as any);
      mockedValidate.mockResolvedValue([
        createValidationError('name', {
          minLength: 'name must be at least 3 characters',
          maxLength: 'name must be at most 100 characters',
        }),
      ]);

      await expect(
        service.parseAndValidate('csv content', TestDto),
      ).rejects.toThrow('name must be at least 3 characters');
    });

    it('should only show first error from each row in the message', async () => {
      const rows = [{ name: 'X', year: '2010' }];
      mockPapaComplete(rows);

      const dto = { name: 'X', year: '2010' };
      mockedPlainToClass.mockReturnValue(dto as any);
      mockedValidate.mockResolvedValue([
        createValidationError('name', {
          minLength: 'name must be at least 3 characters',
          maxLength: 'name must be at most 100 characters',
        }),
      ]);

      try {
        await service.parseAndValidate('csv content', TestDto);
      } catch (error) {
        expect(error.message).toMatch(
          /Row 1: name must be at least 3 characters/,
        );
        expect(error.message).not.toMatch(
          /name must be at most 100 characters/,
        );
      }
    });

    it('should return all valid rows even when some rows are invalid', async () => {
      const rows = [
        { name: 'Inception', year: '2010' },
        { name: '', year: '2014' },
        { name: 'Dunkirk', year: '2017' },
      ];
      mockPapaComplete(rows);

      mockedPlainToClass.mockImplementation((_, obj) => obj as any);

      mockedValidate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          createValidationError('name', {
            isNotEmpty: 'name should not be empty',
          }),
        ])
        .mockResolvedValueOnce([]);

      try {
        await service.parseAndValidate('csv content', TestDto);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Validation failed. Row 2:');
        expect(error.message).toContain('name should not be empty');
        expect(error.message).not.toContain('Row 1:');
        expect(error.message).not.toContain('Row 3:');
      }
    });
  });
});
