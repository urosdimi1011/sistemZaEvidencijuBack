import { Router, Request, Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/authMiddleware'
import { AppDataSource } from '../data-source'
import { Menadzer } from '../entity/Menadzer'
import {ManagerPayment} from "../entity/ManagerPayment";
import {Occupation} from "../entity/Occupation";
import {School} from "../entity/School";
import {StudentService} from "../services/student.service";
import { poredjaniSmerovi, redosledIzSpiska } from "../utiles/redosledSmerova";
const router = Router()
const occupationRepo = AppDataSource.getRepository(Occupation)
const schoolRepo = AppDataSource.getRepository(School)

/** Gornja granica je tu samo da promašen unos ne prođe kao cena. */
const MAX_CENA = 1_000_000;

/**
 * Cena smera: broj od 0 do MAX_CENA, ili null za "nije određena".
 * Vraća `undefined` kad unos uopšte nije upotrebljiv, da bi ruta mogla
 * da razlikuje "obriši cenu" od "pogrešan unos".
 */
function parseCena(vrednost: unknown): number | null | undefined {
    if (vrednost === null || vrednost === undefined || vrednost === '') {
        return null;
    }
    const broj = Number(String(vrednost).trim().replace(',', '.'));
    if (!Number.isFinite(broj) || broj < 0 || broj > MAX_CENA) {
        return undefined;
    }
    return Math.round(broj * 100) / 100;
}

router.get('/', async (_req, res) => {
    const schools = await schoolRepo.find({
        relations: ['occupations'],
    });
    // Redosled smerova je ručno određen po školi — isti svuda gde se
    // smerovi nabrajaju, da se poredak ne razlikuje od ekrana do ekrana
    for (const skola of schools) {
        skola.occupations = poredjaniSmerovi(skola.occupations);
    }
    res.json(schools);
});
router.get('/occupations', async (req: Request, res: Response) => {
    const studentService = new StudentService();
    try {
        const {schoolId} = req.query;
        const occupations = await studentService.getOccupationsForSchool(Number(schoolId));
        res.json(poredjaniSmerovi(occupations));
    } catch (error : any) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/school/:schoolId', async (req, res) => {
    try {
        const { schoolId } = req.params;

        const idSchool = parseInt(schoolId);

        const schools = await schoolRepo.find({
            where: { id: idSchool },
            relations: ['occupations']
        });

        if (!schools || schools.length === 0) {
            return res.status(404).json({
                error: 'Škola nije pronađena'
            });
        }

        for (const skola of schools) {
            skola.occupations = poredjaniSmerovi(skola.occupations);
        }

        res.json(schools);

    } catch (error) {
        console.error('Greška pri dohvatanju smerova za školu:', error);
        res.status(500).json({
            error: 'Interna greška servera'
        });
    }
});

/**
 * Pregled svih smerova sa cenama, grupisan po školama.
 * Služi stranici na kojoj administracija održava cene.
 */
router.get('/cene', async (_req, res) => {
    try {
        const skole = await schoolRepo.find({
            relations: ['occupations'],
            order: { name: 'ASC' },
        });

        res.json(
            skole.map((skola) => ({
                schoolId: skola.id,
                schoolName: skola.name,
                aktivna: skola.aktivan,
                occupations: poredjaniSmerovi(skola.occupations).map((o) => ({
                    id: o.id,
                    name: o.name,
                    zaRedovne: o.zaRedovne,
                    aktivan: o.aktivan,
                    redosled: o.redosled,
                    // decimal iz Postgresa stiže kao string
                    cena: o.cena === null ? null : Number(o.cena),
                })),
            }))
        );
    } catch (error) {
        console.error('Greška pri dohvatanju cena po smerovima:', error);
        res.status(500).json({ error: 'Interna greška servera' });
    }
});

/**
 * Izmena podrazumevane cene smera.
 *
 * Menja se samo cena za BUDUĆE upise — već upisani učenici zadržavaju
 * cenu sa kojom su upisani, jer je ona zapisana na njihovom zapisu.
 */
router.patch('/:id/cena', async (req: AuthenticatedRequest, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                message: 'Cenu smera može da menja samo administrator',
            });
        }

        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Nevalidan smer' });
        }

        const cena = parseCena(req.body?.cena);
        if (cena === undefined) {
            return res.status(400).json({
                message: 'Cena mora biti broj od 0 do 1.000.000, ili prazno',
            });
        }

        const smer = await occupationRepo.findOne({ where: { id } });
        if (!smer) {
            return res.status(404).json({ message: 'Smer nije pronađen' });
        }

        smer.cena = cena;
        await occupationRepo.save(smer);

        res.json({
            id: smer.id,
            name: smer.name,
            cena: smer.cena === null ? null : Number(smer.cena),
        });
    } catch (error) {
        console.error('Greška pri izmeni cene smera:', error);
        res.status(500).json({ error: 'Interna greška servera' });
    }
});

/**
 * Paljenje i gašenje smera.
 *
 * Gašenje NIŠTA ne briše — smer ostaje u bazi, učenici na njemu zadrže
 * svoj smer i vide se svuda. Menja se jedino to što se smer više ne
 * nudi pri upisu novog učenika.
 */
router.patch('/:id/aktivan', async (req: AuthenticatedRequest, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                message: 'Смерове може да гаси само администратор',
            });
        }

        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Неисправан смер' });
        }
        if (typeof req.body?.aktivan !== 'boolean') {
            return res
                .status(400)
                .json({ message: 'Недостаје вредност (укључено/искључено)' });
        }

        const smer = await occupationRepo.findOne({ where: { id } });
        if (!smer) {
            return res.status(404).json({ message: 'Смер није пронађен' });
        }

        smer.aktivan = req.body.aktivan;
        await occupationRepo.save(smer);

        res.json({ id: smer.id, name: smer.name, aktivan: smer.aktivan });
    } catch (error) {
        console.error('Greška pri gašenju smera:', error);
        res.status(500).json({ error: 'Интерна грешка сервера' });
    }
});

/**
 * Paljenje i gašenje škole.
 * Ugašena škola se ne nudi pri upisu, a sa njom ni njeni smerovi.
 */
router.patch('/skola/:id/aktivan', async (req: AuthenticatedRequest, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                message: 'Школе може да гаси само администратор',
            });
        }

        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Неисправна школа' });
        }
        if (typeof req.body?.aktivan !== 'boolean') {
            return res
                .status(400)
                .json({ message: 'Недостаје вредност (укључено/искључено)' });
        }

        const skola = await schoolRepo.findOne({ where: { id } });
        if (!skola) {
            return res.status(404).json({ message: 'Школа није пронађена' });
        }

        skola.aktivan = req.body.aktivan;
        await schoolRepo.save(skola);

        res.json({ id: skola.id, name: skola.name, aktivan: skola.aktivan });
    } catch (error) {
        console.error('Greška pri gašenju škole:', error);
        res.status(500).json({ error: 'Интерна грешка сервера' });
    }
});

/**
 * Izmena redosleda smerova u okviru jedne škole.
 *
 * Prima CEO spisak id-jeva u željenom poretku, ne zamenu dva po dva —
 * tako ne može da se desi da dva smera dobiju isti broj, ni da redosled
 * ostane napola izmenjen ako nešto pukne u sredini.
 */
router.patch('/skola/:id/redosled', async (req: AuthenticatedRequest, res) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        if (req.user?.role !== 'admin') {
            await queryRunner.rollbackTransaction();
            return res.status(403).json({
                message: 'Редослед смерова може да мења само администратор',
            });
        }

        const schoolId = parseInt(req.params.id, 10);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({ message: 'Неисправна школа' });
        }

        const noviRedosled = redosledIzSpiska(req.body?.ids);
        if (!noviRedosled) {
            await queryRunner.rollbackTransaction();
            return res
                .status(400)
                .json({ message: 'Неисправан списак смерова' });
        }

        // Svi prosleđeni smerovi moraju da budu baš iz te škole
        const smerovi = await queryRunner.manager.find(Occupation, {
            where: { school: { id: schoolId } },
            relations: ['school'],
        });
        const idUSkoli = new Set(smerovi.map((s) => s.id));

        for (const id of noviRedosled.keys()) {
            if (!idUSkoli.has(id)) {
                await queryRunner.rollbackTransaction();
                return res.status(400).json({
                    message: 'Списак садржи смер који не припада тој школи',
                });
            }
        }

        for (const smer of smerovi) {
            const nov = noviRedosled.get(smer.id);
            if (nov !== undefined && smer.redosled !== nov) {
                smer.redosled = nov;
                await queryRunner.manager.save(smer);
            }
        }

        await queryRunner.commitTransaction();

        const posle = await occupationRepo.find({
            where: { school: { id: schoolId } },
        });
        res.json(
            poredjaniSmerovi(posle).map((o) => ({
                id: o.id,
                name: o.name,
                redosled: o.redosled,
            }))
        );
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error('Greška pri izmeni redosleda smerova:', error);
        res.status(500).json({ error: 'Интерна грешка сервера' });
    } finally {
        await queryRunner.release();
    }
});

/** Naziv: očišćen od viška razmaka, u razumnoj dužini. */
function parseNaziv(vrednost: unknown): string | null {
    if (typeof vrednost !== 'string') return null;
    const naziv = vrednost.trim().replace(/\s+/g, ' ');
    if (naziv.length < 2 || naziv.length > 150) return null;
    return naziv;
}

/** Nova škola. */
router.post('/skola', async (req: AuthenticatedRequest, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                message: 'Школе може да додаје само администратор',
            });
        }

        const naziv = parseNaziv(req.body?.name);
        if (!naziv) {
            return res.status(400).json({
                message: 'Назив школе мора имати између 2 и 150 знакова',
            });
        }

        const postoji = await schoolRepo.findOne({ where: { name: naziv } });
        if (postoji) {
            return res
                .status(409)
                .json({ message: `Школа „${naziv}” већ постоји` });
        }

        const skola = schoolRepo.create({ name: naziv, aktivan: true });
        const sacuvana = await schoolRepo.save(skola);

        res.status(201).json({
            schoolId: sacuvana.id,
            schoolName: sacuvana.name,
            aktivna: sacuvana.aktivan,
            occupations: [],
        });
    } catch (error) {
        console.error('Greška pri dodavanju škole:', error);
        res.status(500).json({ error: 'Интерна грешка сервера' });
    }
});

/** Nov smer u okviru škole. Cena je opciona. */
router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                message: 'Смерове може да додаје само администратор',
            });
        }

        const naziv = parseNaziv(req.body?.name);
        if (!naziv) {
            return res.status(400).json({
                message: 'Назив смера мора имати између 2 и 150 знакова',
            });
        }

        const schoolId = parseInt(req.body?.schoolId, 10);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            return res.status(400).json({ message: 'Неисправна школа' });
        }

        const skola = await schoolRepo.findOne({ where: { id: schoolId } });
        if (!skola) {
            return res.status(404).json({ message: 'Школа није пронађена' });
        }

        const cena = parseCena(req.body?.cena);
        if (cena === undefined) {
            return res.status(400).json({
                message: 'Цена мора бити број од 0 до 1.000.000, или празно',
            });
        }

        // Naziv smera je jedinstven u celom sistemu, ne po školi — zato
        // se proverava svuda, da poruka bude jasna umesto greške iz baze
        const postoji = await occupationRepo.findOne({
            where: { name: naziv },
            relations: ['school'],
        });
        if (postoji) {
            return res.status(409).json({
                message:
                    `Смер „${naziv}” већ постоји` +
                    (postoji.school ? ` у школи „${postoji.school.name}”` : '') +
                    '. Називи смерова морају бити јединствени у целом систему.',
            });
        }

        const smer = occupationRepo.create({
            name: naziv,
            school: skola,
            cena,
            zaRedovne: req.body?.zaRedovne === true,
            aktivan: true,
        });
        const sacuvan = await occupationRepo.save(smer);

        res.status(201).json({
            id: sacuvan.id,
            name: sacuvan.name,
            zaRedovne: sacuvan.zaRedovne,
            aktivan: sacuvan.aktivan,
            cena: sacuvan.cena === null ? null : Number(sacuvan.cena),
        });
    } catch (error) {
        console.error('Greška pri dodavanju smera:', error);
        res.status(500).json({ error: 'Интерна грешка сервера' });
    }
});

export default router