import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Redovni učenici se upisuju po razredima, od prvog do četvrtog —
 * i kada krenu u prvi, i kada pređu iz druge škole u bilo koji razred.
 *
 * Vanredni učenici nemaju razred; kod njih tu ulogu ima "tip upisa"
 * (prekvalifikacija / dokvalifikacija / vanredni). Zato kolona sme da
 * bude prazna i ništa se ne popunjava unazad.
 */
export class RazredZaRedovneUcenike1789863000000 implements MigrationInterface {
  name = "RazredZaRedovneUcenike1789863000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student" ADD "razred" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "razred"`);
  }
}
