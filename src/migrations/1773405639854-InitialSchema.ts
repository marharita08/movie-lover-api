import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1773405639854 implements MigrationInterface {
  name = 'InitialSchema1773405639854';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."chat_message_author_enum" AS ENUM('user', 'assistant')`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_message" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "text" character varying NOT NULL, "author" "public"."chat_message_author_enum" NOT NULL, "userId" uuid NOT NULL, "mediaItems" jsonb, "isError" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_3cc0d85193aade457d3077dd06b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "person" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tmdbId" integer NOT NULL, "name" character varying NOT NULL, "profilePath" character varying, CONSTRAINT "UQ_18c99094e6b3b8857d71df81121" UNIQUE ("tmdbId"), CONSTRAINT "PK_5fdaf670315c4b7e70cce85daa3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."media_person_role_enum" AS ENUM('actor', 'director')`,
    );
    await queryRunner.query(
      `CREATE TABLE "media_person" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "mediaItemId" uuid NOT NULL, "personId" uuid NOT NULL, "role" "public"."media_person_role_enum" NOT NULL, CONSTRAINT "PK_d6f4789612281b2366f3cfa281b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_119ddda298cafa71a456f04a31" ON "media_person" ("mediaItemId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4af1ffda2cf82f55b7109241a0" ON "media_person" ("personId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8f43b8cca15f979dbb1ccb1179" ON "media_person" ("role") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_81516e50f541f400cb45077a54" ON "media_person" ("mediaItemId", "personId", "role") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."media_item_type_enum" AS ENUM('movie', 'tv')`,
    );
    await queryRunner.query(
      `CREATE TABLE "media_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "imdbId" character varying NOT NULL, "title" character varying NOT NULL, "type" "public"."media_item_type_enum" NOT NULL, "genres" text array NOT NULL DEFAULT '{}', "countries" text array NOT NULL DEFAULT '{}', "companies" text array NOT NULL DEFAULT '{}', "nextEpisodeAirDate" date, "year" integer, "imdbRating" numeric(3,1), "runtime" integer, "tmdbId" integer, "posterPath" character varying, "numberOfEpisodes" integer, "status" character varying, "lastSyncAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_a275b94c22aaf90a5bd67a88c5c" UNIQUE ("imdbId"), CONSTRAINT "PK_ca307a9a9117b0c8edc6eb4cd97" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a275b94c22aaf90a5bd67a88c5" ON "media_item" ("imdbId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4e12e37a3f12af44f24a19a2b7" ON "media_item" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_64c5766a84be3471c2f5bd938b" ON "media_item" ("year") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_39a1b489f7f51a7d31659a5ab6" ON "media_item" ("tmdbId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "list_media_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "listId" uuid NOT NULL, "mediaItemId" uuid NOT NULL, "userRating" integer, "dateRated" date, "position" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_d0baf5e4db8447e8546eee46c71" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_704951adca0c30c01cc895c2f6" ON "list_media_item" ("listId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_87518d1b38271466901455f402" ON "list_media_item" ("mediaItemId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_14afe037643851b5cb72bf53bd" ON "list_media_item" ("listId", "mediaItemId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."list_status_enum" AS ENUM('processing', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "list" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "fileId" uuid NOT NULL, "userId" uuid NOT NULL, "totalItems" integer NOT NULL DEFAULT '0', "status" "public"."list_status_enum" NOT NULL DEFAULT 'processing', "errorMessage" character varying, CONSTRAINT "REL_7b6bb1c6fea7215a42217d03c4" UNIQUE ("fileId"), CONSTRAINT "PK_d8feafd203525d5f9c37b3ed3b9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "file" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "key" character varying NOT NULL, "url" character varying NOT NULL, "type" character varying NOT NULL, "size" integer NOT NULL, "userId" uuid, CONSTRAINT "PK_36b46d232307066b3a2c9ea3a1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "passwordHash" character varying(255) NOT NULL, "lastLoginAt" TIMESTAMP WITH TIME ZONE NOT NULL, "lastActiveAt" TIMESTAMP WITH TIME ZONE NOT NULL, "isEmailVerified" boolean NOT NULL DEFAULT false, "googleId" character varying(255), CONSTRAINT "UQ_470355432cc67b2c470c30bef7c" UNIQUE ("googleId"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reset_password_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_c6f6eb8f5c88ac0233eceb8d385" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."otp_purpose_enum" AS ENUM('EMAIL_VERIFICATION', 'RESET_PASSWORD')`,
    );
    await queryRunner.query(
      `CREATE TABLE "otp" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying NOT NULL, "code" integer NOT NULL, "purpose" "public"."otp_purpose_enum" NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_32556d9d7b22031d7d0e1fd6723" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "session" ("id" character varying NOT NULL, "userId" uuid NOT NULL, "refreshToken" character varying(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD CONSTRAINT "FK_a44ec486210e6f8b4591776d6f3" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_person" ADD CONSTRAINT "FK_119ddda298cafa71a456f04a317" FOREIGN KEY ("mediaItemId") REFERENCES "media_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_person" ADD CONSTRAINT "FK_4af1ffda2cf82f55b7109241a0b" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "list_media_item" ADD CONSTRAINT "FK_704951adca0c30c01cc895c2f68" FOREIGN KEY ("listId") REFERENCES "list"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "list_media_item" ADD CONSTRAINT "FK_87518d1b38271466901455f402f" FOREIGN KEY ("mediaItemId") REFERENCES "media_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "list" ADD CONSTRAINT "FK_7b6bb1c6fea7215a42217d03c49" FOREIGN KEY ("fileId") REFERENCES "file"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "list" ADD CONSTRAINT "FK_46ded14b26382088c9f032f8953" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "file" ADD CONSTRAINT "FK_b2d8e683f020f61115edea206b3" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reset_password_token" ADD CONSTRAINT "FK_3fde3055d9d16236c05d030915e" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_3d2f174ef04fb312fdebd0ddc53" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT "FK_3d2f174ef04fb312fdebd0ddc53"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reset_password_token" DROP CONSTRAINT "FK_3fde3055d9d16236c05d030915e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "file" DROP CONSTRAINT "FK_b2d8e683f020f61115edea206b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "list" DROP CONSTRAINT "FK_46ded14b26382088c9f032f8953"`,
    );
    await queryRunner.query(
      `ALTER TABLE "list" DROP CONSTRAINT "FK_7b6bb1c6fea7215a42217d03c49"`,
    );
    await queryRunner.query(
      `ALTER TABLE "list_media_item" DROP CONSTRAINT "FK_87518d1b38271466901455f402f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "list_media_item" DROP CONSTRAINT "FK_704951adca0c30c01cc895c2f68"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_person" DROP CONSTRAINT "FK_4af1ffda2cf82f55b7109241a0b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_person" DROP CONSTRAINT "FK_119ddda298cafa71a456f04a317"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP CONSTRAINT "FK_a44ec486210e6f8b4591776d6f3"`,
    );
    await queryRunner.query(`DROP TABLE "session"`);
    await queryRunner.query(`DROP TABLE "otp"`);
    await queryRunner.query(`DROP TYPE "public"."otp_purpose_enum"`);
    await queryRunner.query(`DROP TABLE "reset_password_token"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "file"`);
    await queryRunner.query(`DROP TABLE "list"`);
    await queryRunner.query(`DROP TYPE "public"."list_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_14afe037643851b5cb72bf53bd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_87518d1b38271466901455f402"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_704951adca0c30c01cc895c2f6"`,
    );
    await queryRunner.query(`DROP TABLE "list_media_item"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_39a1b489f7f51a7d31659a5ab6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_64c5766a84be3471c2f5bd938b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4e12e37a3f12af44f24a19a2b7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a275b94c22aaf90a5bd67a88c5"`,
    );
    await queryRunner.query(`DROP TABLE "media_item"`);
    await queryRunner.query(`DROP TYPE "public"."media_item_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_81516e50f541f400cb45077a54"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8f43b8cca15f979dbb1ccb1179"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4af1ffda2cf82f55b7109241a0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_119ddda298cafa71a456f04a31"`,
    );
    await queryRunner.query(`DROP TABLE "media_person"`);
    await queryRunner.query(`DROP TYPE "public"."media_person_role_enum"`);
    await queryRunner.query(`DROP TABLE "person"`);
    await queryRunner.query(`DROP TABLE "chat_message"`);
    await queryRunner.query(`DROP TYPE "public"."chat_message_author_enum"`);
  }
}
