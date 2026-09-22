import { MigrationInterface, QueryRunner } from "typeorm";

export class OdvajanjeLiteratureOdSkolarine1789862500000 implements MigrationInterface {
    name = 'OdvajanjeLiteratureOdSkolarine1789862500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Literatura se od sada naplaćuje odvojeno od školarine.
        // NULL = nije plaćena. Postojeći učenici kreću od "nije plaćeno".
        await queryRunner.query(`ALTER TABLE "student" ADD "literaturePaidAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "literaturePaidAt"`);
    }

}
