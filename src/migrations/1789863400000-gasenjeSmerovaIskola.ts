import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Gašenje smerova i škola.
 *
 * Smer koji se više ne upisuje ne može da se obriše — za njim stoji
 * istorija učenika. Zato se gasi: ostaje u bazi i svuda se vidi, ali se
 * više NE NUDI pri upisu novog učenika.
 *
 * Gasi se samo PONUDA, nikad prikaz. Učenik upisan na ugašen smer i
 * dalje ima taj smer u spisku, u svojim detaljima i u izveštajima —
 * inače bi se prošle godine tiho promenile.
 *
 * Sve zatečeno ostaje aktivno (default true), pa se posle migracije
 * ništa ne menja dok administrator nešto ne ugasi.
 */
export class GasenjeSmerovaIskola1789863400000 implements MigrationInterface {
  name = "GasenjeSmerovaIskola1789863400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "occupation" ADD "aktivan" boolean NOT NULL DEFAULT true`
    );
    await queryRunner.query(
      `ALTER TABLE "school" ADD "aktivan" boolean NOT NULL DEFAULT true`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "school" DROP COLUMN "aktivan"`);
    await queryRunner.query(`ALTER TABLE "occupation" DROP COLUMN "aktivan"`);
  }
}
