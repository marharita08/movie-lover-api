import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity()
export class Otp extends BaseEntity {
  @Column()
  email: string;

  @Column()
  code: number;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}
