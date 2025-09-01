import { MigrationInterface, QueryRunner } from "typeorm";

export class DodavanjeIzmenaZa1756307847242 implements MigrationInterface {
    name = 'DodavanjeIzmenaZa1756307847242'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student" RENAME COLUMN "zanimanje" TO "occupationId"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "occupationId"`);
        await queryRunner.query(`ALTER TABLE "student" ADD "occupationId" integer`);
        await queryRunner.query(`ALTER TABLE "student" ADD CONSTRAINT "FK_855837b2c592c1b71b89ab7fda3" FOREIGN KEY ("occupationId") REFERENCES "occupation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student" DROP CONSTRAINT "FK_855837b2c592c1b71b89ab7fda3"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "occupationId"`);
        await queryRunner.query(`ALTER TABLE "student" ADD "occupationId" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "student" RENAME COLUMN "occupationId" TO "zanimanje"`);
    }

}
