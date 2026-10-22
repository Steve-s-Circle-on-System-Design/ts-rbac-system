import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUserResetToken1786447365000 implements MigrationInterface {
  name = 'RemoveUserResetToken1786447365000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "resetToken"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "resetToken" character varying`,
    );
  }
}
