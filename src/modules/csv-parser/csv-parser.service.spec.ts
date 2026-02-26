import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
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

      await expect(service.parseAndValidate('', TestDto)).rejects.toMatchObject(
        {
          response: {
            message: 'CSV file is empty',
          },
        },
      );
    });

    it('should throw BadRequestException if first row fails validation', async () => {
      const rows = [{ name: '', year: '2010' }];
      mockPapaComplete(rows);

      const dto = { name: '', year: '2010' };
      mockedPlainToClass.mockReturnValue(dto as any);
      mockedValidate.mockResolvedValue([
        {
          property: 'name',
          constraints: { isNotEmpty: 'name should not be empty' },
        } as any,
      ]);

      await expect(
        service.parseAndValidate('name,year\n,2010', TestDto),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.parseAndValidate('name,year\n,2010', TestDto),
      ).rejects.toMatchObject({
        response: {
          message: 'Invalid CSV structure: name should not be empty',
        },
      });
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
      mockedPlainToClass.mockReturnValueOnce(dto1 as any);
      mockedPlainToClass.mockReturnValueOnce(dto2 as any);
      mockedValidate.mockResolvedValue([]);

      const result = await service.parseAndValidate(
        'name,year\nInception,2010\nInterstellar,2014',
        TestDto,
      );

      expect(result).toHaveLength(2);
      expect(mockedValidate).toHaveBeenCalledTimes(3); // first row check + 2 rows
    });

    it('should throw BadRequestException with row-specific errors when some rows fail validation', async () => {
      const rows = [
        { name: 'Inception', year: '2010' },
        { name: '', year: '2014' },
        { name: 'Dunkirk', year: '' },
      ];
      mockPapaComplete(rows);

      const dto1 = { name: 'Inception', year: '2010' };
      const dto2 = { name: '', year: '2014' };
      const dto3 = { name: 'Dunkirk', year: '' };

      mockedPlainToClass
        .mockReturnValueOnce(dto1 as any) // first row check
        .mockReturnValueOnce(dto1 as any) // row 1 validation
        .mockReturnValueOnce(dto2 as any) // row 2 validation
        .mockReturnValueOnce(dto3 as any); // row 3 validation

      mockedValidate
        .mockResolvedValueOnce([]) // first row check passes
        .mockResolvedValueOnce([]) // row 1 valid
        .mockResolvedValueOnce([
          {
            property: 'name',
            constraints: { isNotEmpty: 'name should not be empty' },
          } as any,
        ]) // row 2 invalid
        .mockResolvedValueOnce([
          {
            property: 'year',
            constraints: { isNotEmpty: 'year should not be empty' },
          } as any,
        ]); // row 3 invalid

      try {
        await service.parseAndValidate('csv content', TestDto);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.response.message).toContain(
          'Some rows contain invalid data',
        );
        expect(error.response.errors).toEqual([
          { row: 2, errors: ['name should not be empty'] },
          { row: 3, errors: ['year should not be empty'] },
        ]);
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
        {
          property: 'name',
          constraints: {
            minLength: 'name must be at least 3 characters',
            maxLength: 'name must be at most 100 characters',
          },
        } as any,
      ]);

      try {
        await service.parseAndValidate('csv content', TestDto);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.response.message).toContain(
          'name must be at least 3 characters',
        );
        expect(error.response.message).toContain(
          'name must be at most 100 characters',
        );
      }
    });
  });
});
