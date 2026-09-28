import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailVerificationTokens1790582058935 implements MigrationInterface {
  name = 'CreateEmailVerificationTokens1790582058935';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_verification_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tokenHash" character varying NOT NULL,
        "userId" uuid NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "consumedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_verification_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_verification_tokens_tokenHash" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_email_verification_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_email_verification_tokens_tokenHash" ON "email_verification_tokens" ("tokenHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_verification_tokens_userId" ON "email_verification_tokens" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_email_verification_tokens_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_email_verification_tokens_tokenHash"`,
    );
    await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
  }
}
