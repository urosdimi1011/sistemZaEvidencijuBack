import { MigrationInterface, QueryRunner } from "typeorm";

export class IzmenaTabeleStudent1756902144706 implements MigrationInterface {
    name = 'IzmenaTabeleStudent1756902144706'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student" DROP CONSTRAINT "FK_013887eef90f4cd16de6cc091d9"`);
        await queryRunner.query(`ALTER TABLE "manager_payment" DROP CONSTRAINT "FK_fe62e72577a4048d4f43ef72bce"`);
        await queryRunner.query(`ALTER TABLE "manager_payment" ALTER COLUMN "studentId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "student" ALTER COLUMN "procenatManagera" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "student" ALTER COLUMN "procenatManagera" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "manager_payment" ADD CONSTRAINT "FK_fe62e72577a4048d4f43ef72bce" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student" ADD CONSTRAINT "FK_013887eef90f4cd16de6cc091d9" FOREIGN KEY ("managerId") REFERENCES "menadzer"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student" DROP CONSTRAINT "FK_013887eef90f4cd16de6cc091d9"`);
        await queryRunner.query(`ALTER TABLE "manager_payment" DROP CONSTRAINT "FK_fe62e72577a4048d4f43ef72bce"`);
        await queryRunner.query(`ALTER TABLE "student" ALTER COLUMN "procenatManagera" SET DEFAULT '20'`);
        await queryRunner.query(`ALTER TABLE "student" ALTER COLUMN "procenatManagera" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "manager_payment" ALTER COLUMN "studentId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "manager_payment" ADD CONSTRAINT "FK_fe62e72577a4048d4f43ef72bce" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student" ADD CONSTRAINT "FK_013887eef90f4cd16de6cc091d9" FOREIGN KEY ("managerId") REFERENCES "menadzer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
