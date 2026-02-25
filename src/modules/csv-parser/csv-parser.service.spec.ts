import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as Papa from 'papaparse';

import { CsvParserService } from './csv-parser.service';

jest.mock('papaparse');

const mockedPapa = Papa as jest.Mocked<typeof Papa>;

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
});
