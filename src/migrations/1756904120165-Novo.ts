import { MigrationInterface, QueryRunner } from "typeorm";

export class Novo1756904120165 implements MigrationInterface {


    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ukloni NOT NULL constraint sa managerId
        await queryRunner.query(`ALTER TABLE "student" ALTER COLUMN "managerId" DROP NOT NULL`);

        // Ukloni NOT NULL constraint sa procenatManagera
        await queryRunner.query(`ALTER TABLE "student" ALTER COLUMN "procenatManagera" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Vrati NOT NULL constraint (opciono)
        await queryRunner.query(`ALTER TABLE "student" ALTER COLUMN "managerId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "student" ALTER COLUMN "procenatManagera" SET NOT NULL`);
    }

}
