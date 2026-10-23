import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Veza isplate menadžeru sa uplatom učenika.
 *
 * Menadžer zarađuje svoj procenat postepeno, od svake uplate učenika:
 * školarina 1500 i 20% znači da od uplaćenih 500 menadžeru sledi 100,
 * od sledećih 1000 još 200, i na kraju ukupno 300.
 *
 * Zato svaka uplata učenika nosi svoju "ratu" za menadžera. Rata se NE
 * upisuje u bazu — računa se iz uplate i procenta, pa uvek prati izmenu
 * uplate. U bazu se upisuje samo kad je menadžeru zaista isplaćeno, i
 * tada zapis pokazuje na uplatu koju pokriva.
 *
 * Jedinstveni indeks: jedna uplata može biti pokrivena najviše jednom
 * isplatom, da dvostruki klik ne isplati menadžeru dvaput.
 *
 * NULL znači isplatu uneseну ručno, pre ovog načina rada. Takve ostaju
 * i dalje važeće i ulaze u ukupan iznos isplaćen menadžeru.
 */
export class IsplataVezanaZaUplatu1789863300000 implements MigrationInterface {
  name = "IsplataVezanaZaUplatu1789863300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "manager_payment" ADD "paymentId" integer`
    );

    await queryRunner.query(
      `ALTER TABLE "manager_payment" ADD CONSTRAINT "FK_manager_payment_payment"
       FOREIGN KEY ("paymentId") REFERENCES "payment"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    // Postgres dozvoljava više NULL vrednosti u jedinstvenom indeksu,
    // pa ovo ne smeta ranije unetim isplatama
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_manager_payment_payment"
       ON "manager_payment" ("paymentId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_manager_payment_payment"`);
    await queryRunner.query(
      `ALTER TABLE "manager_payment" DROP CONSTRAINT "FK_manager_payment_payment"`
    );
    await queryRunner.query(
      `ALTER TABLE "manager_payment" DROP COLUMN "paymentId"`
    );
  }
}
