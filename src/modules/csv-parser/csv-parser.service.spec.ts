import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToClass } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import * as Papa from 'papaparse';

import { TranslationKeys } from 'src/const/translations/keys';
import { TranslationService } from 'src/modules/translation/translation.service';

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

const makeValidationError = (
  property: string,
  constraints: Record<string, string>,
): ValidationError => {
  const error = new ValidationError();
  error.property = property;
  error.constraints = constraints;
  return error;
};

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvParserService,
        {
          provide: TranslationService,
          useValue: { t: jest.fn((key: string) => key) },
        },
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

  describe('parse', () => {
    it('should return parsed rows with default options', async () => {
      const rows = [
        { name: 'Inception', year: '2010' },
        { name: 'Interstellar', year: '2014' },
      ];

      mockPapaComplete(rows);

      const result = await service.parse('csv');

      expect(result).toEqual(rows);
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
    beforeEach(() => {
      mockedPlainToClass.mockImplementation((_cls, v) => v as any);
    });

    it('should throw BadRequestException when CSV is empty', async () => {
      mockPapaComplete([]);

      await expect(
        service.parseAndValidate('', TestDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should return valid rows when all pass validation', async () => {
      const rows = [
        { name: 'Inception', year: '2010' },
        { name: 'Interstellar', year: '2014' },
      ];

      mockPapaComplete(rows);
      mockedValidate.mockResolvedValue([]);

      const result = await service.parseAndValidate('csv', TestDto);

      expect(result).toHaveLength(2);
      expect(result).toEqual(rows);
    });

    it('should throw BadRequestException and use VALIDATION_FAILED message when ≤5 rows invalid', async () => {
      const rows = [
        { name: 'Inception', year: '2010' },
        { name: '', year: '2014' },
      ];

      mockPapaComplete(rows);
      mockedValidate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          makeValidationError('name', { isNotEmpty: 'name required' }),
        ]);

      await expect(service.parseAndValidate('csv', TestDto)).rejects.toThrow(
        TranslationKeys.VALIDATION_FAILED,
      );
    });

    it('should use VALIDATION_FAILED_ROWS message when >5 rows invalid', async () => {
      const rows = Array.from({ length: 7 }, (_, i) => ({
        name: '',
        year: String(i),
      }));

      mockPapaComplete(rows);
      mockedValidate.mockResolvedValue([
        makeValidationError('name', { isNotEmpty: 'name required' }),
      ]);

      await expect(service.parseAndValidate('csv', TestDto)).rejects.toThrow(
        TranslationKeys.VALIDATION_FAILED_ROWS,
      );
    });

    it('should include only valid rows in result and throw when any are invalid', async () => {
      const rows = [
        { name: 'Inception', year: '2010' },
        { name: '', year: '2011' },
        { name: 'Dune', year: '2021' },
      ];

      mockPapaComplete(rows);
      mockedValidate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          makeValidationError('name', { isNotEmpty: 'required' }),
        ])
        .mockResolvedValueOnce([]);

      await expect(
        service.parseAndValidate('csv', TestDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should report at most 5 error details in the message even with more errors', async () => {
      const rows = Array.from({ length: 15 }, (_, i) => ({
        name: '',
        year: String(i),
      }));

      mockPapaComplete(rows);
      mockedValidate.mockResolvedValue([
        makeValidationError('name', { isNotEmpty: 'required' }),
      ]);

      await expect(
        service.parseAndValidate('csv', TestDto),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockedValidate).toHaveBeenCalledTimes(15);
    });

    it('should pass custom delimiter option to parser', async () => {
      mockPapaComplete([{ name: 'A', year: '1' }]);
      mockedValidate.mockResolvedValue([]);

      await service.parseAndValidate('a;b', TestDto, { delimiter: ';' });

      expect(mockedPapa.parse).toHaveBeenCalledWith(
        'a;b',
        expect.objectContaining({ delimiter: ';' }),
      );
    });
  });
});
