import { MigrationInterface, QueryRunner } from "typeorm";

export class DodavanjeIzmena1756301970413 implements MigrationInterface {
    name = 'DodavanjeIzmena1756301970413'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student" DROP CONSTRAINT "FK_013887eef90f4cd16de6cc091d9"`);
        await queryRunner.query(`ALTER TABLE "student" ADD CONSTRAINT "FK_013887eef90f4cd16de6cc091d9" FOREIGN KEY ("managerId") REFERENCES "menadzer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student" DROP CONSTRAINT "FK_013887eef90f4cd16de6cc091d9"`);
        await queryRunner.query(`ALTER TABLE "student" ADD CONSTRAINT "FK_013887eef90f4cd16de6cc091d9" FOREIGN KEY ("managerId") REFERENCES "menadzer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
