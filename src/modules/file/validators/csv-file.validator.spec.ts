import { CsvFileValidator } from './csv-file.validator';

const makeFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    originalname: 'test.csv',
    mimetype: 'text/csv',
    size: 1024,
    ...overrides,
  }) as Express.Multer.File;

describe('CsvFileValidator', () => {
  let validator: CsvFileValidator;

  beforeEach(() => {
    validator = new CsvFileValidator();
  });

  describe('isValid', () => {
    it('should return true for a valid csv file', () => {
      expect(validator.isValid(makeFile())).toBe(true);
    });

    it('should return false if no file provided', () => {
      expect(validator.isValid(undefined)).toBe(false);
    });

    it('should return false if file extension is not .csv', () => {
      expect(validator.isValid(makeFile({ originalname: 'test.pdf' }))).toBe(
        false,
      );
    });

    it('should return false if mime type is not allowed', () => {
      expect(validator.isValid(makeFile({ mimetype: 'application/pdf' }))).toBe(
        false,
      );
    });

    it('should return false if file is empty', () => {
      expect(validator.isValid(makeFile({ size: 0 }))).toBe(false);
    });

    it('should return true for all allowed mime types', () => {
      const allowedMimeTypes = [
        'text/csv',
        'application/csv',
        'application/vnd.ms-excel',
        'text/plain',
      ];

      allowedMimeTypes.forEach((mimetype) => {
        expect(validator.isValid(makeFile({ mimetype }))).toBe(true);
      });
    });
  });

  describe('buildErrorMessage', () => {
    it('should return default message if isValid was not called', () => {
      expect(validator.buildErrorMessage()).toBe('Invalid CSV file');
    });

    it('should return error message if no file provided', () => {
      validator.isValid(undefined);
      expect(validator.buildErrorMessage()).toBe('No file provided');
    });

    it('should return error message with actual extension if extension is invalid', () => {
      validator.isValid(makeFile({ originalname: 'test.pdf' }));
      expect(validator.buildErrorMessage()).toBe(
        'Invalid file extension. Expected .csv but got .pdf',
      );
    });

    it('should return error message with actual mime type if mime type is invalid', () => {
      validator.isValid(makeFile({ mimetype: 'application/pdf' }));
      expect(validator.buildErrorMessage()).toBe(
        'Invalid MIME type. Expected CSV but got application/pdf',
      );
    });

    it('should return error message if file is empty', () => {
      validator.isValid(makeFile({ size: 0 }));
      expect(validator.buildErrorMessage()).toBe('File is empty');
    });
  });
});
