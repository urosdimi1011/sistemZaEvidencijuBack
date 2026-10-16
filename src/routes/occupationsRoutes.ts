import { Router, Request, Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/authMiddleware'
import { AppDataSource } from '../data-source'
import { Menadzer } from '../entity/Menadzer'
import {ManagerPayment} from "../entity/ManagerPayment";
import {Occupation} from "../entity/Occupation";
import {School} from "../entity/School";
import {StudentService} from "../services/student.service";
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
    res.json(schools);
});
router.get('/occupations', async (req: Request, res: Response) => {
    const studentService = new StudentService();
    try {
        const {schoolId} = req.query;
        const occupations = await studentService.getOccupationsForSchool(Number(schoolId));
        res.json(occupations);
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
                occupations: [...(skola.occupations ?? [])]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((o) => ({
                        id: o.id,
                        name: o.name,
                        zaRedovne: o.zaRedovne,
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

export default router