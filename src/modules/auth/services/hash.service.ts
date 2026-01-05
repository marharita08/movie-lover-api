import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HashService {
  private readonly saltRounds = 12;

  hash(str: string): string {
    return bcrypt.hash(str, this.saltRounds) as string;
  }

  compare(str: string, hash: string): boolean {
    return bcrypt.compare(str, hash) as boolean;
  }
}
