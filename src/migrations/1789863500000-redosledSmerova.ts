import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Ručno određen redosled smerova.
 *
 * Škole imaju svoj uobičajen poredak koji nije azbučni — kod medicinske
 * prvo ide medicinska sestra tehničar, pa zubni, pa fizioterapeutski, i
 * tek onda ostali. Do sada se svuda sortiralo po nazivu.
 *
 * Manji broj ide napre. Nula znači "neodređeno" i takvi smerovi padaju
 * na kraj, međusobno poređani po nazivu — zato zatečeni smerovi ostaju
 * tačno onako kako su se i do sada prikazivali.
 */
export class RedosledSmerova1789863500000 implements MigrationInterface {
  name = "RedosledSmerova1789863500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "occupation" ADD "redosled" integer NOT NULL DEFAULT 0`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "occupation" DROP COLUMN "redosled"`);
  }
}
