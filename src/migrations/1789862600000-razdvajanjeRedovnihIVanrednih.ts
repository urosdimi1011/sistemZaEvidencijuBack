import { MigrationInterface, QueryRunner } from "typeorm";

export class RazdvajanjeRedovnihIVanrednih1789862600000 implements MigrationInterface {
    name = 'RazdvajanjeRedovnihIVanrednih1789862600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Nalog škole od sada obrađuje samo jednu vrstu upisa.
        // NULL = nalog nije vezan za vrstu (admin, računovođa).
        await queryRunner.query(`ALTER TABLE "user" ADD "tipUpisa" character varying`);

        // Postojeći nalozi škola do sada su unosili vanredne učenike
        await queryRunner.query(
            `UPDATE "user" SET "tipUpisa" = 'vandredni' WHERE "role" = 'school_manager'`
        );

        // Učenici uneti pre uvođenja tipa su vanredni (potvrđeno sa naručiocem).
        // Napomena: posle ovoga se više ne razlikuju od ranije označenih vanrednih.
        await queryRunner.query(
            `UPDATE "student" SET "type" = 'vandredni' WHERE "type" IS NULL`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Tip učenika se ne vraća na NULL — podatak o tome ko je ranije bio
        // bez tipa ne postoji, pa bi vraćanje obrisalo i ispravne vrednosti.
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "tipUpisa"`);
    }

}
