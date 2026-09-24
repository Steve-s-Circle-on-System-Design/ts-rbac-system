import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailLogs1790168338333 implements MigrationInterface {
  name = 'CreateEmailLogs1790168338333';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."email_logs_status_enum" AS ENUM('PENDING', 'SENT', 'FAILED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "email_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "jobId" character varying NOT NULL,
        "jobName" character varying NOT NULL,
        "recipient" character varying NOT NULL,
        "payloadMetadata" jsonb,
        "status" "public"."email_logs_status_enum" NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "providerResponseId" character varying,
        "errorMessage" text,
        "errorMetadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "sentAt" TIMESTAMP,
        "failedAt" TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_email_logs_jobId" ON "email_logs" ("jobId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_logs_recipient" ON "email_logs" ("recipient")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_logs_status" ON "email_logs" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_logs_createdAt" ON "email_logs" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_email_logs_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_email_logs_status"`);
    await queryRunner.query(`DROP INDEX "IDX_email_logs_recipient"`);
    await queryRunner.query(`DROP INDEX "IDX_email_logs_jobId"`);
    await queryRunner.query(`DROP TABLE "email_logs"`);
    await queryRunner.query(`DROP TYPE "public"."email_logs_status_enum"`);
  }
}
