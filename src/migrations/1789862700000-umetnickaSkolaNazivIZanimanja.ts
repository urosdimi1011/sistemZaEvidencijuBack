import { MigrationInterface, QueryRunner } from "typeorm";

export class UmetnickaSkolaNazivIZanimanja1789862700000 implements MigrationInterface {
    name = 'UmetnickaSkolaNazivIZanimanja1789862700000'

    private readonly novaZanimanja = [
        'Техничар за дигиталну графику и интернет обликовање',
        'Техничар фотографије',
    ];

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Skraćen naziv škole
        await queryRunner.query(
            `UPDATE "school" SET "name" = 'Средња уметничка школа'
             WHERE "name" = 'Средња уметничка школа за дизајн и нове медије'`
        );

        // Nova zanimanja — preskaču se ako već postoje (naziv je jedinstven u tabeli)
        for (const naziv of this.novaZanimanja) {
            await queryRunner.query(
                `INSERT INTO "occupation" ("name", "schoolId")
                 SELECT $1::varchar, s."id" FROM "school" s
                 WHERE s."name" = 'Средња уметничка школа'
                   AND NOT EXISTS (
                       SELECT 1 FROM "occupation" o WHERE o."name" = $1::varchar
                   )`,
                [naziv]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const naziv of this.novaZanimanja) {
            // Briše se samo ako nijedan učenik nije upisan na to zanimanje
            await queryRunner.query(
                `DELETE FROM "occupation" o
                 WHERE o."name" = $1
                   AND NOT EXISTS (
                       SELECT 1 FROM "student" st WHERE st."occupationId" = o."id"
                   )`,
                [naziv]
            );
        }

        await queryRunner.query(
            `UPDATE "school" SET "name" = 'Средња уметничка школа за дизајн и нове медије'
             WHERE "name" = 'Средња уметничка школа'`
        );
    }

}
