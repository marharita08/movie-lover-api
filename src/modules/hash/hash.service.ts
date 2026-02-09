import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HashService {
  private readonly saltRounds = 12;

  async hash(str: string): Promise<string> {
    return (await bcrypt.hash(str, this.saltRounds)) as unknown as string;
  }

  async compare(str: string, hash: string): Promise<boolean> {
    return (await bcrypt.compare(str, hash)) as unknown as boolean;
  }
}
