import { FileValidator } from '@nestjs/common';

export class CsvFileValidator extends FileValidator {
  private errorMessage: string;

  constructor(protected readonly validationOptions: Record<string, any> = {}) {
    super(validationOptions);
  }

  buildErrorMessage(): string {
    return this.errorMessage || 'Invalid CSV file';
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      this.errorMessage = 'No file provided';
      return false;
    }

    const fileName = file.originalname.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      const extension = fileName.slice(fileName.lastIndexOf('.'));
      this.errorMessage = `Invalid file extension. Expected .csv but got ${extension}`;
      return false;
    }

    const allowedMimeTypes = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'text/plain',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      this.errorMessage = `Invalid MIME type. Expected CSV but got ${file.mimetype}`;
      return false;
    }

    if (file.size === 0) {
      this.errorMessage = 'File is empty';
      return false;
    }

    return true;
  }
}
