// src/routes/menadzerRoutes.ts
import { Router, Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import { Menadzer } from '../entity/Menadzer'
import {ManagerPayment} from "../entity/ManagerPayment";
import {Occupation} from "../entity/Occupation";
import {School} from "../entity/School";
import {StudentService} from "../services/student.service";
const router = Router()
const occupationRepo = AppDataSource.getRepository(Occupation)
const schoolRepo = AppDataSource.getRepository(School)

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
export default router