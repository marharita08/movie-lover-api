import { BaseEntity, Column, Entity } from 'typeorm';

@Entity()
export class Otp extends BaseEntity {
  @Column()
  email: string;

  @Column()
  code: number;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}
