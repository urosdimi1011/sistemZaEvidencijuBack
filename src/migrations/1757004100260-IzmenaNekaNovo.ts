import { MigrationInterface, QueryRunner } from "typeorm";

export class IzmenaNekaNovo1757004100260 implements MigrationInterface {
    name = 'IzmenaNekaNovo1757004100260'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "schoolId" integer`);
        await queryRunner.query(`ALTER TABLE "student" DROP CONSTRAINT "FK_855837b2c592c1b71b89ab7fda3"`);
        await queryRunner.query(`ALTER TABLE "student" DROP CONSTRAINT "FK_013887eef90f4cd16de6cc091d9"`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_709e51110daa2b560f0fc32367b" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student" ADD CONSTRAINT "FK_855837b2c592c1b71b89ab7fda3" FOREIGN KEY ("occupationId") REFERENCES "occupation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student" ADD CONSTRAINT "FK_013887eef90f4cd16de6cc091d9" FOREIGN KEY ("managerId") REFERENCES "menadzer"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student" DROP CONSTRAINT "FK_013887eef90f4cd16de6cc091d9"`);
        await queryRunner.query(`ALTER TABLE "student" DROP CONSTRAINT "FK_855837b2c592c1b71b89ab7fda3"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_709e51110daa2b560f0fc32367b"`);
        await queryRunner.query(`ALTER TABLE "student" ADD CONSTRAINT "FK_013887eef90f4cd16de6cc091d9" FOREIGN KEY ("managerId") REFERENCES "menadzer"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student" ADD CONSTRAINT "FK_855837b2c592c1b71b89ab7fda3" FOREIGN KEY ("occupationId") REFERENCES "occupation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "schoolId"`);
    }

}
