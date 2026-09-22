import { MigrationInterface, QueryRunner } from "typeorm";

export class ObradaNapomeneZaUcenika1789862800000 implements MigrationInterface {
    name = 'ObradaNapomeneZaUcenika1789862800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Administrator može da označi napomenu kao obrađenu.
        // NULL = neobrađena, pa se učenik ističe u spisku.
        await queryRunner.query(`ALTER TABLE "student" ADD "noteHandledAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "noteHandledAt"`);
    }

}
