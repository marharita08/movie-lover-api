import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLanguage1779219536899 implements MigrationInterface {
  name = 'AddLanguage1779219536899';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "language" character varying(255) NOT NULL DEFAULT 'en-US'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "language"`);
  }
}
