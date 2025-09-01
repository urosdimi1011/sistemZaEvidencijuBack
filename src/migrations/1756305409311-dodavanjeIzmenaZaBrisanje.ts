import { MigrationInterface, QueryRunner } from "typeorm";

export class DodavanjeIzmenaZaBrisanje1756305409311 implements MigrationInterface {
    name = 'DodavanjeIzmenaZaBrisanje1756305409311'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_f2af0d65275b237384bb70a468d"`);
        await queryRunner.query(`ALTER TABLE "manager_payment" DROP CONSTRAINT "FK_10fab86698e0b2cc906f5300a41"`);
        await queryRunner.query(`ALTER TABLE "manager_payment" DROP CONSTRAINT "FK_fe62e72577a4048d4f43ef72bce"`);
        await queryRunner.query(`ALTER TABLE "student" DROP CONSTRAINT "FK_013887eef90f4cd16de6cc091d9"`);
        await queryRunner.query(`ALTER TABLE "payment" ADD CONSTRAINT "FK_f2af0d65275b237384bb70a468d" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "manager_payment" ADD CONSTRAINT "FK_10fab86698e0b2cc906f5300a41" FOREIGN KEY ("menadzerId") REFERENCES "menadzer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "manager_payment" ADD CONSTRAINT "FK_fe62e72577a4048d4f43ef72bce" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student" ADD CONSTRAINT "FK_013887eef90f4cd16de6cc091d9" FOREIGN KEY ("managerId") REFERENCES "menadzer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student" DROP CONSTRAINT "FK_013887eef90f4cd16de6cc091d9"`);
        await queryRunner.query(`ALTER TABLE "manager_payment" DROP CONSTRAINT "FK_fe62e72577a4048d4f43ef72bce"`);
        await queryRunner.query(`ALTER TABLE "manager_payment" DROP CONSTRAINT "FK_10fab86698e0b2cc906f5300a41"`);
        await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_f2af0d65275b237384bb70a468d"`);
        await queryRunner.query(`ALTER TABLE "student" ADD CONSTRAINT "FK_013887eef90f4cd16de6cc091d9" FOREIGN KEY ("managerId") REFERENCES "menadzer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "manager_payment" ADD CONSTRAINT "FK_fe62e72577a4048d4f43ef72bce" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "manager_payment" ADD CONSTRAINT "FK_10fab86698e0b2cc906f5300a41" FOREIGN KEY ("menadzerId") REFERENCES "menadzer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment" ADD CONSTRAINT "FK_f2af0d65275b237384bb70a468d" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
