import { MigrationInterface, QueryRunner } from "typeorm";

export class DodavanjeNovihTabelaIKolona1756301846074 implements MigrationInterface {
    name = 'DodavanjeNovihTabelaIKolona1756301846074'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "occupation" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "schoolId" integer NOT NULL, CONSTRAINT "UQ_47dc90a06f122e0b7256fa1e5fd" UNIQUE ("name"), CONSTRAINT "PK_07cfcefef555693d96dce8805c5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "school" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_73c2a2b94ffa6b0fabf50b64743" UNIQUE ("name"), CONSTRAINT "PK_57836c3fe2f2c7734b20911755e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "student" ADD "imeRoditelja" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "student" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "procenatManagera"`);
        await queryRunner.query(`DROP TYPE "public"."student_procenatmanagera_enum"`);
        await queryRunner.query(`ALTER TABLE "student" ADD "procenatManagera" integer NOT NULL DEFAULT '20'`);
        await queryRunner.query(`ALTER TABLE "occupation" ADD CONSTRAINT "FK_a37ce82c297a9d2e6321a27676a" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "occupation" DROP CONSTRAINT "FK_a37ce82c297a9d2e6321a27676a"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "procenatManagera"`);
        await queryRunner.query(`CREATE TYPE "public"."student_procenatmanagera_enum" AS ENUM('0', '10', '20', '30', '40', '50')`);
        await queryRunner.query(`ALTER TABLE "student" ADD "procenatManagera" "public"."student_procenatmanagera_enum" NOT NULL DEFAULT '20'`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "imeRoditelja"`);
        await queryRunner.query(`DROP TABLE "school"`);
        await queryRunner.query(`DROP TABLE "occupation"`);
    }

}
