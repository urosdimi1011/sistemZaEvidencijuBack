// src/routes/menadzerRoutes.ts
import { Router, Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import { Menadzer } from '../entity/Menadzer'
import {ManagerPayment} from "../entity/ManagerPayment";
import {Occupation} from "../entity/Occupation";
import {School} from "../entity/School";
import {StudentService} from "../services/student.service";
import { ponudaZaUpis, nazivSaOznakom } from "../utiles/ponudaZaUpis";
import { poredjaniSmerovi } from "../utiles/redosledSmerova";
const router = Router()
const schoolRepo = AppDataSource.getRepository(School)

router.get('/', async (_req, res) => {
    const schools = await schoolRepo.find({
        relations: ['occupations'],
    });
    // Ručno određen redosled smerova — isti svuda gde se nabrajaju
    for (const skola of schools) {
        skola.occupations = poredjaniSmerovi(skola.occupations);
    }
    res.json(schools);
});

/**
 * Škole za izbor pri upisu učenika.
 *
 * Ugašene se ne nude. Izuzetak je škola koja je već izabrana kod
 * učenika koji se menja (`zadrzi`) — bez toga bi se kod izmene starog
 * učenika polje ispraznilo i ne bi mogao da se sačuva bez promene škole.
 */
router.get('/all', async (_req, res) => {
    const zadrzi = Number(_req.query.zadrzi);

    const schools = await schoolRepo.find({ order: { name: 'ASC' } });

    const skole = ponudaZaUpis(schools, zadrzi).map(m => ({
        value: m.id,
        label: nazivSaOznakom(m, 'угашена'),
    }));

    res.json(skole);
});


router.get('/:id/occupations', async (_req, res) => {
    const id = _req.params.id as unknown as number;
    const schools = await schoolRepo.findOne(
        {
            where : {id: id},
            relations : ['occupations']
        },
    );

    if (!schools) {
        return res.status(404).json({ message: 'Škola nije pronađena' });
    }

    // Redovnim učenicima se nudi samo određen skup zanimanja; vanrednima sva.
    // Nalog vezan za vrstu upisa ne može da zaobiđe ovo preko parametra.
    const user = (_req as any).user;
    const tipNaloga = user?.role === 'school_manager' ? user?.tipUpisa : null;
    const trazeniTip = tipNaloga || (_req.query.tip as string);

    if (trazeniTip === 'redovni') {
        schools.occupations = schools.occupations.filter((o) => o.zaRedovne);
    }

    // Ugašeni smerovi se ne nude pri upisu. Izuzetak je smer koji je
    // već izabran kod učenika koji se menja — inače bi se kod izmene
    // starog učenika polje ispraznilo i morao bi da mu se menja smer.
    // Redosled je ručno određen po školi — isti svuda gde se smerovi
    // nabrajaju, da se poredak ne razlikuje od ekrana do ekrana
    schools.occupations = poredjaniSmerovi(
        ponudaZaUpis(schools.occupations, Number(_req.query.zadrzi))
    );

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

router.get('/:id', async (_req, res) => {
    const id = _req.params.id as unknown as number;
    const school = await schoolRepo.find({
        where : {id: id}
    });
    const skola = school.map(m => ({
        value: m.id,
        label: `${m.name}`
    }));
    res.json(skola);
});
export default router