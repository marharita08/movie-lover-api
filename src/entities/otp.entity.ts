import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum OtpPurpose {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  RESET_PASSWORD = 'RESET_PASSWORD',
}

@Entity()
export class Otp extends BaseEntity {
  @Column()
  email: string;

  @Column()
  code: number;

  @Column({ type: 'enum', enum: OtpPurpose })
  purpose: OtpPurpose;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}
