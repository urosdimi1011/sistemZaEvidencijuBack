import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Cena školarine zavisi od smera i menja se svake školske godine.
 *
 * Ovo je PODRAZUMEVANA cena, samo da se polje pri upisu učenika samo
 * popuni — administracija je po potrebi menja za pojedinačnog učenika.
 *
 * Istorija se ne gubi time što se ova vrednost svake godine prepisuje:
 * svaki učenik nosi svoju "cenaSkolarine" na sopstvenom zapisu, pa
 * prošle generacije zadržavaju cenu sa kojom su upisane.
 *
 * NULL znači da cena za taj smer još nije određena.
 */
export class CenaSkolarinePoSmeru1789863100000 implements MigrationInterface {
  name = "CenaSkolarinePoSmeru1789863100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "occupation" ADD "cena" numeric(10,2)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "occupation" DROP COLUMN "cena"`);
  }
}
