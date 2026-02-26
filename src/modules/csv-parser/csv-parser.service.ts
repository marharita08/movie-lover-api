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

    const firstRow = plainToClass(dtoClass, rows[0]);
    const errors = await validate(firstRow);

    if (errors.length > 0) {
      throw new BadRequestException({
        message: `Invalid CSV structure: ${this.formatValidationErrors(errors).join(', ')}`,
      });
    }

    const validatedRows: T[] = [];
    const validationErrors: Array<{ row: number; errors: string[] }> = [];

    for (let i = 0; i < rows.length; i++) {
      const dto = plainToClass(dtoClass, rows[i]);
      const rowErrors = await validate(dto);

      if (rowErrors.length > 0) {
        validationErrors.push({
          row: i + 1,
          errors: this.formatValidationErrors(rowErrors),
        });
      } else {
        validatedRows.push(dto);
      }
    }

    if (validationErrors.length > 0) {
      throw new BadRequestException({
        message: `Some rows contain invalid data: ${validationErrors.map((error) => `Row ${error.row}: ${error.errors.join(', ')}`).join(', ')}`,
        errors: validationErrors,
      });
    }

    return validatedRows;
  }

  private formatValidationErrors(errors: ValidationError[]): string[] {
    return errors.flatMap((error) => Object.values(error.constraints || {}));
  }
}
