// src/routes/menadzerRoutes.ts
import { Router, Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import { Menadzer } from '../entity/Menadzer'
import {ManagerPayment} from "../entity/ManagerPayment";
import {Occupation} from "../entity/Occupation";
import {School} from "../entity/School";
import {StudentService} from "../services/student.service";
const router = Router()
const schoolRepo = AppDataSource.getRepository(School)

router.get('/', async (_req, res) => {
    const schools = await schoolRepo.find({
        relations: ['occupations'],
    });
    res.json(schools);
});

router.get('/all', async (_req, res) => {
    const schools = await schoolRepo.find();

    const skole = schools.map(m => ({
        value: m.id,
        label: `${m.name}`
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