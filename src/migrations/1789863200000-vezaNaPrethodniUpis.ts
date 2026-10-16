import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Veza na prethodni upis istog učenika.
 *
 * Redovni učenik se svake školske godine upisuje iznova, sa svojom cenom
 * i svojim uplatama — Zoran kroz četiri razreda su ČETIRI zapisa. Bez
 * veze među njima sistem ne zna da je reč o istoj osobi.
 *
 * Šta ova veza omogućava:
 *
 *  1. Menadžer uzima 10% samo jednom. Zapis nastao prebacivanjem ima
 *     popunjen "prethodniUpisId", pa se zna da to nije prvi upis u školu
 *     i da menadžer tu ne ide.
 *
 *  2. Dvostruko prebacivanje nije moguće. Jedinstveni indeks ispod ne
 *     dozvoljava dva zapisa koja pokazuju na isti prethodni upis — da
 *     dvostruki klik ne udvostruči celu generaciju.
 *
 *  3. Istorija učenika kroz razrede.
 *
 * NULL znači prvi upis u našu školu — bilo u prvi razred, bilo prelaskom
 * iz druge škole u viši.
 */
export class VezaNaPrethodniUpis1789863200000 implements MigrationInterface {
  name = "VezaNaPrethodniUpis1789863200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "student" ADD "prethodniUpisId" integer`
    );

    await queryRunner.query(
      `ALTER TABLE "student" ADD CONSTRAINT "FK_student_prethodni_upis"
       FOREIGN KEY ("prethodniUpisId") REFERENCES "student"("id")
       ON DELETE SET NULL ON UPDATE NO ACTION`
    );

    // Postgres dozvoljava više NULL vrednosti u jedinstvenom indeksu, pa
    // ovo ne smeta učenicima koji su prvi put upisani.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_student_prethodni_upis"
       ON "student" ("prethodniUpisId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_student_prethodni_upis"`);
    await queryRunner.query(
      `ALTER TABLE "student" DROP CONSTRAINT "FK_student_prethodni_upis"`
    );
    await queryRunner.query(
      `ALTER TABLE "student" DROP COLUMN "prethodniUpisId"`
    );
  }
}
