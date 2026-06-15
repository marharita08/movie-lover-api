import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToClass } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { I18nService } from 'nestjs-i18n';
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

const mockI18nService = {
  t: jest.fn((key: string) => key),
};

class TestDto {
  name: string;
  year: string;
}

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvParserService,
        { provide: I18nService, useValue: mockI18nService },
      ],
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
    it('should return parsed rows', async () => {
      const rows = [
        { name: 'Inception', year: '2010' },
        { name: 'Interstellar', year: '2014' },
      ];

      mockPapaComplete(rows);

      const result = await service.parse('csv');

      expect(result).toEqual(rows);
    });

    it('should pass default options', async () => {
      mockPapaComplete([]);

      await service.parse('csv');

      expect(mockedPapa.parse).toHaveBeenCalledWith(
        'csv',
        expect.objectContaining({
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
          dynamicTyping: false,
        }),
      );
    });

    it('should throw BadRequestException on parse errors', async () => {
      mockPapaComplete(
        [],
        [{ type: 'Quotes', code: 'MissingQuotes', message: 'err', row: 1 }],
      );

      await expect(service.parse('csv')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should propagate Papa error', async () => {
      mockPapaError(new Error('fail'));

      await expect(service.parse('csv')).rejects.toThrow('fail');
    });
  });

  describe('parseAndValidate', () => {
    it('should throw if CSV is empty', async () => {
      mockPapaComplete([]);

      await expect(
        service.parseAndValidate('', TestDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should return valid rows', async () => {
      const rows = [
        { name: 'Inception', year: '2010' },
        { name: 'Interstellar', year: '2014' },
      ];

      mockPapaComplete(rows);
      mockedPlainToClass.mockImplementation((_, v) => v as any);
      mockedValidate.mockResolvedValue([]);

      const result = await service.parseAndValidate('csv', TestDto);

      expect(result).toHaveLength(2);
    });

    it('should throw when some rows are invalid (no message assertions)', async () => {
      const rows = [
        { name: 'A', year: '2010' },
        { name: '', year: '2014' },
      ];

      mockPapaComplete(rows);
      mockedPlainToClass.mockImplementation((_, v) => v as any);

      mockedValidate.mockResolvedValueOnce([]).mockResolvedValueOnce([
        createValidationError('name', {
          isNotEmpty: 'required',
        }),
      ]);

      await expect(
        service.parseAndValidate('csv', TestDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should pass delimiter option', async () => {
      mockPapaComplete([{ name: 'A', year: '1' }]);
      mockedPlainToClass.mockImplementation((_, v) => v as any);
      mockedValidate.mockResolvedValue([]);

      await service.parseAndValidate('a;b', TestDto, { delimiter: ';' });

      expect(mockedPapa.parse).toHaveBeenCalledWith(
        'a;b',
        expect.objectContaining({ delimiter: ';' }),
      );
    });

    it('should collect valid rows even with invalid ones', async () => {
      const rows = [
        { name: 'A', year: '2010' },
        { name: '', year: '2011' },
        { name: 'C', year: '2012' },
      ];

      mockPapaComplete(rows);
      mockedPlainToClass.mockImplementation((_, v) => v as any);

      mockedValidate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          createValidationError('name', { isNotEmpty: 'required' }),
        ])
        .mockResolvedValueOnce([]);

      await expect(
        service.parseAndValidate('csv', TestDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
