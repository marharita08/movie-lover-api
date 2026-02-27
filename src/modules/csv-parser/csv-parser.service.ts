import {
  BadRequestException,
  Injectable,
  ValidationError,
} from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import * as Papa from 'papaparse';

export interface ParseOptions {
  header?: boolean;
  skipEmptyLines?: boolean;
  delimiter?: string;
  dynamicTyping?: boolean;
  transformHeader?: (header: string) => string;
}

@Injectable()
export class CsvParserService {
  async parse<T = any>(
    csvContent: string,
    options: ParseOptions = {},
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      Papa.parse<T>(csvContent, {
        header: options.header ?? true,
        skipEmptyLines: options.skipEmptyLines ?? true,
        delimiter: options.delimiter ?? ',',
        dynamicTyping: options.dynamicTyping ?? false,
        transformHeader: options.transformHeader,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(
              new BadRequestException({
                message: 'CSV parsing failed',
                errors: results.errors,
              }),
            );
          } else {
            resolve(results.data);
          }
        },
        error: (error: unknown) => {
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      });
    });
  }

  async parseAndValidate<T extends object>(
    csvContent: string,
    dtoClass: new () => T,
    options: ParseOptions = {},
  ): Promise<T[]> {
    const rows = await this.parse<T>(csvContent, options);

    if (rows.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    const MAX_ERRORS_TO_REPORT = 10;
    const BATCH_SIZE = 100;

    const validatedRows: T[] = [];
    const validationErrors: Array<{ row: number; errors: string[] }> = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      const dtos = batch.map((row) => plainToClass(dtoClass, row));

      const results = await Promise.all(dtos.map((dto) => validate(dto)));

      for (let j = 0; j < results.length; j++) {
        const errors = results[j];
        const rowIndex = i + j;

        if (errors.length > 0) {
          validationErrors.push({
            row: rowIndex + 1,
            errors: this.formatValidationErrors(errors),
          });

          if (validationErrors.length >= MAX_ERRORS_TO_REPORT) {
            break;
          }
        } else {
          validatedRows.push(dtos[j]);
        }
      }

      if (validationErrors.length >= MAX_ERRORS_TO_REPORT) {
        break;
      }
    }

    if (validationErrors.length > 0) {
      const totalErrorRows = validationErrors.length;

      const errorDetails = validationErrors
        .slice(0, 5)
        .map((e) => `Row ${e.row}: ${e.errors[0]}`)
        .join('. ');

      const hasMoreErrors = totalErrorRows > 5;

      const message = hasMoreErrors
        ? `Validation failed for at least ${totalErrorRows} rows. First errors - ${errorDetails}. Please fix the errors and try again.`
        : `Validation failed. ${errorDetails}`;

      throw new BadRequestException(message);
    }

    return validatedRows;
  }

  private formatValidationErrors(errors: ValidationError[]): string[] {
    return errors.flatMap((error) => Object.values(error.constraints || {}));
  }
}
