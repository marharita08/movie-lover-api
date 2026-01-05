import { BaseEntity } from './base.entity';
import { Column, Entity } from 'typeorm';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'timestamptz' })
  lastLoginAt: Date;

  @Column({ type: 'timestamptz' })
  lastActiveAt: Date;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;
}
