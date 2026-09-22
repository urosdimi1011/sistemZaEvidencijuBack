import { MigrationInterface, QueryRunner } from "typeorm";

export class DodavanjeProcentaMenadzeru1789862400000 implements MigrationInterface {
    name = 'DodavanjeProcentaMenadzeru1789862400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Podrazumevani procenat menadžera. Svi postojeći menadžeri dobijaju 20%.
        await queryRunner.query(`ALTER TABLE "menadzer" ADD "procenat" integer NOT NULL DEFAULT '20'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "menadzer" DROP COLUMN "procenat"`);
    }

}
