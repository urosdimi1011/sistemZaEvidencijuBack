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
export default router