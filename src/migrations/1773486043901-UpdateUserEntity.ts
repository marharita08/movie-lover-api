import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserEntity1773486043901 implements MigrationInterface {
  name = 'UpdateUserEntity1773486043901';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "passwordHash" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "passwordHash" SET NOT NULL`,
    );
  }
}
