import { MigrationInterface, QueryRunner } from "typeorm";

export class ZanimanjaZaRedovneUcenike1789862900000 implements MigrationInterface {
    name = 'ZanimanjaZaRedovneUcenike1789862900000'

    // Zanimanja koja fale, po školi
    private readonly novaZanimanja: { naziv: string; skola: string }[] = [
        { naziv: 'Туристичко-хотелијерски техничар', skola: 'Средња школа ДОСИТЕЈ' },
        { naziv: 'Физиотерапеутски техничар', skola: 'Средња медицинска школа' },
        { naziv: 'Стоматолошка сестра', skola: 'Средња медицинска школа' },
    ];

    // Zanimanja koja se nude redovnim učenicima (naziv je jedinstven u tabeli)
    private readonly zaRedovne: string[] = [
        // Средња школа ДОСИТЕЈ
        'Општа гимназија',
        'Економски техничар',
        'Правно-пословни техничар',
        'Туристичко-хотелијерски техничар',
        // Средња техничка школа
        'Електротехничар информационих технологија',
        'Кулинарски техничар',
        'Гимназија за ученике са посебним способностима за рачунарство и информатику',
        // Средња медицинска школа
        'Медицинска сестра техничар',
        'Зубни техничар',
        'Физиотерапеутски техничар',
        'Медицинска сестра васпитач',
        'Фармацеутски техничар',
        'Лабораторијски техничар',
        'Стоматолошка сестра',
        // Средња уметничка школа
        'Ликовни техничар',
        'Техничар дизајна графике',
        'Техничар за дигиталну графику и интернет обликовање',
        'Техничар дизајна ентеријера и индустријских производа',
        'Техничар фотографије',
    ];

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "occupation" ADD "zaRedovne" boolean NOT NULL DEFAULT false`
        );

        for (const { naziv, skola } of this.novaZanimanja) {
            await queryRunner.query(
                `INSERT INTO "occupation" ("name", "schoolId")
                 SELECT $1::varchar, s."id" FROM "school" s
                 WHERE s."name" = $2::varchar
                   AND NOT EXISTS (
                       SELECT 1 FROM "occupation" o WHERE o."name" = $1::varchar
                   )`,
                [naziv, skola]
            );
        }

        for (const naziv of this.zaRedovne) {
            await queryRunner.query(
                `UPDATE "occupation" SET "zaRedovne" = true WHERE "name" = $1::varchar`,
                [naziv]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { naziv } of this.novaZanimanja) {
            // Briše se samo ako nijedan učenik nije upisan na to zanimanje
            await queryRunner.query(
                `DELETE FROM "occupation" o
                 WHERE o."name" = $1::varchar
                   AND NOT EXISTS (
                       SELECT 1 FROM "student" st WHERE st."occupationId" = o."id"
                   )`,
                [naziv]
            );
        }

        await queryRunner.query(`ALTER TABLE "occupation" DROP COLUMN "zaRedovne"`);
    }

}
