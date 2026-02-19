import { BadRequestException, Injectable } from '@nestjs/common';
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
        error: (error) => {
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      });
    });
  }
}
