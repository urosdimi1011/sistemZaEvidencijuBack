// src/routes/studentRoutes.ts
import { Router } from 'express'
import { AppDataSource } from '../data-source'
import {Student} from "../entity/Student";
import {Between, FindOptionsWhere, Like} from "typeorm";
import {object} from "yup";
import {Payment} from "../entity/Payment";
import {StudentService} from "../services/student.service";
import {w} from "@faker-js/faker/dist/airline-CLphikKp";

const router = Router()
const studentiRepo = AppDataSource.getRepository(Student);
const paymentRepo = AppDataSource.getRepository(Payment);
router.get('/', async (req, res) => {
    try {
        const searchTerm = (req.query.search as string)?.trim();
        const datePicker = (req.query.date as string)?.trim();
        const schoolIdTerm = (req.query.schoolId as string)?.trim();

        let where: FindOptionsWhere<Student> | FindOptionsWhere<Student>[] = {};


        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const offset = (page - 1) * limit;

        // Sortiranje parametri
        const sortBy = (req.query.sortBy as string) || 'createdAt';
        const sortOrder = (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC';

        let baseWhere: FindOptionsWhere<Student> = {};


        if (schoolIdTerm) {
            baseWhere.occupation = {
                    school: {
                        id: Number(schoolIdTerm)
                    }
                }
            }

        if (datePicker) {
            const selectedDate = new Date(datePicker);

            if (isNaN(selectedDate.getTime())) {
                return res.status(400).json({message: 'Nevalidan format datuma. Koristite YYYY-MM-DD'});
            }

            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);


            baseWhere.createdAt = Between(startOfDay, endOfDay);

        }

        let finalWhere: FindOptionsWhere<Student> | FindOptionsWhere<Student>[];

        if (searchTerm) {
            const terms = searchTerm.split(/\s+/).filter(t => t.length > 0);
            const searchConditions: FindOptionsWhere<Student>[] = [];

            terms.forEach(term => {
                searchConditions.push(
                    { ...baseWhere, ime: Like(`%${term}%`) },
                    { ...baseWhere, prezime: Like(`%${term}%`) }
                );
            });

            if (terms.length >= 2) {
                searchConditions.push(
                    {
                        ...baseWhere,
                        ime: Like(`%${terms[0]}%`),
                        prezime: Like(`%${terms[1]}%`)
                    },
                    {
                        ...baseWhere,
                        ime: Like(`%${terms[1]}%`),
                        prezime: Like(`%${terms[0]}%`)
                    }
                );
            }
            finalWhere = searchConditions;

        } else {
            finalWhere = baseWhere;
        }

        const allowedSortFields = ['createdAt', 'ime', 'prezime', 'cenaSkolarine'];
        const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

        const order: any = {};
        order[finalSortBy] = sortOrder;
        const [studenti, totalCount] = await studentiRepo.findAndCount({
            where: finalWhere,
            relations: ['menadzer', 'payments', 'managerPayouts', 'occupation.school'],
            order: order,
            take: limit,
            skip: offset
        });




        const result = studenti.map(m => ({
            id: m.id,
            ime: m.ime,
            imeRoditelja: m.imeRoditelja,
            prezime: m.prezime,
            datumKreiranja : m?.createdAt,
            zanimanje: m.occupation ? {
                name : m.occupation?.name,
                id : m.occupation?.id
            } : null,
            cenaSkolarine: m.cenaSkolarine,
            preostaliDug: m.cenaSkolarine - m.payments.reduce((sum,payment)=>sum + Number(payment.amount),0),
            preostaliDugZaMenadzera :(m.cenaSkolarine * (Number(m.procenatManagera) / 100)) - (m.managerPayouts.reduce((sum, payout) => sum + Number(payout.amount), 0)),
            procenatMenadzeru: m.procenatManagera,
            menadzer: m.menadzer,
            schoolId: m.occupation?.school?.id
        }));

        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.json({
            data: result,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalCount,
                itemsPerPage: limit,
                hasNextPage: hasNextPage,
                hasPrevPage: hasPrevPage
            },
            filters: {
                search: searchTerm || null,
                date: datePicker || null,
                schoolId: schoolIdTerm ? Number(schoolIdTerm) : null
            },
            sorting: {
                sortBy: finalSortBy,
                sortOrder: sortOrder
            }
        });

    } catch (error) {
        console.error('Greška pri dobavljanju studenata:', error);
        res.status(500).json({ message: 'Došlo je do greške pri dobavljanju studenata' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const schoolIdTerm = (req.query.schoolId as string)?.trim();
        let where: FindOptionsWhere<Student> = {};

        if (schoolIdTerm) {
            where = {
                occupation: {
                    school: {
                        id: Number(schoolIdTerm)
                    }
                }
            };
        }

        const totalCount = await studentiRepo.count({
            where,
            relations: ['occupation.school']
        });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const todayCount = await studentiRepo.count({
            where: {
                ...where,
                createdAt: Between(todayStart, todayEnd)
            },
            relations: ['occupation.school']
        });

        res.json({
            totalStudents: totalCount,
            todayStudents: todayCount,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('Greška pri dobavljanju statistika:', error);
        res.status(500).json({ message: 'Došlo je do greške pri dobavljanju statistika' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const student = await studentiRepo.findOne({
            where: { id: studentId },
            relations: ["payments","managerPayouts","occupation"] // Ovo će uključiti i povezane platne podatke
        });
        if (!student) {
            return res.status(404).json({ message: 'Student nije pronađen' });
        }
        const totalPaid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const remainingAmount = student.cenaSkolarine - totalPaid;
        const commissionAmount = Number(student.cenaSkolarine) * (Number(student.procenatManagera) / 100);




        const totalPaidToManager = student.managerPayouts.reduce((sum, payout) => sum + Number(payout.amount), 0);

        const remainingForManager = commissionAmount - totalPaidToManager;


        res.json({
            student: {
                id: student.id,
                ime: student.ime,
                prezime: student.prezime,
                imeRoditelja: student.imeRoditelja,
                zanimanje: student.occupation?.id,
                datumKreiranja : student?.createdAt,
                ukupnaSkolarina: student.cenaSkolarine,
                ukupnoMenadzeru : commissionAmount,
                preostaloMenadzeru : remainingForManager,
                managerId : student.managerId,
                payments: {
                    totalPaid,
                    remainingAmount,
                    installments: student.payments // Sve uplate
                },
                managerPayments:{
                    installments : student.managerPayouts
                },
                schoolId: student.occupation?.school?.id
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Došlo je do greške pri dobavljanju studenata' });
    }
});

router.post('/', async (req, res) => {
    try {
        const dataForSend = object(req.body).fields;
        const novi = studentiRepo.create(dataForSend);
        const sacuvan = await studentiRepo.save(novi);
        let studentSaMenadzerom = await studentiRepo.findOne({
            where: { id: sacuvan.id },
            relations: ['menadzer', 'payments','managerPayouts','occupation'],
        });

        if (!studentSaMenadzerom) {
            return res.status(404).json({ message: 'Student nije pronađen' });
        }


        const result = {
            id: studentSaMenadzerom.id,
            ime: studentSaMenadzerom.ime,
            prezime: studentSaMenadzerom.prezime,
            datumKreiranja : studentSaMenadzerom?.createdAt,
            imeRoditelja: studentSaMenadzerom.imeRoditelja,
            zanimanje: studentSaMenadzerom.occupation ? {
                name : studentSaMenadzerom.occupation.name,
                id : studentSaMenadzerom.occupation.id
            } : null,
            cenaSkolarine: studentSaMenadzerom.cenaSkolarine,
            preostaliDug: studentSaMenadzerom.cenaSkolarine - studentSaMenadzerom.payments.reduce((sum,payment)=>sum + Number(payment.amount),0),
            procenatMenadzeru: studentSaMenadzerom.procenatManagera,
            menadzer: studentSaMenadzerom.menadzer,
            schoolId: studentSaMenadzerom.occupation?.school?.id

        };

        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err });
    }
});


router.patch('/:id', async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const dataForSend = req.body;

        if (dataForSend.managerId === null || dataForSend.managerId === undefined || dataForSend.managerId === '') {
            dataForSend.managerId = null;
        }
        if (dataForSend.procenatManagera === null || dataForSend.procenatManagera === undefined || dataForSend.procenatManagera === '') {
            dataForSend.procenatManagera = null;
        }

        const updateResult = await studentiRepo.update(studentId, dataForSend);

        if (updateResult.affected === 0) {
            return res.status(404).json({ error: 'Student nije pronađen' });
        }

        const updatedStudent = await studentiRepo.findOne({
            where: { id: studentId },
            relations: ['menadzer','payments','occupation']
        });

        if (!updatedStudent) {
            return res.status(404).json({ message: 'Student nije pronađen' });
        }

        const result = {
            id: updatedStudent.id,
            ime: updatedStudent.ime,
            prezime: updatedStudent.prezime,
            imeRoditelja: updatedStudent.imeRoditelja,
            datumKreiranja : updatedStudent?.createdAt,
            zanimanje: updatedStudent.occupation ? {
                name : updatedStudent.occupation.name,
                id : updatedStudent.occupation.id
            } : null,
            cenaSkolarine: updatedStudent.cenaSkolarine,
            preostaliDug: updatedStudent.cenaSkolarine - updatedStudent.payments.reduce((sum,payment)=>sum + Number(payment.amount),0),
            procenatMenadzeru: updatedStudent.procenatManagera,
            menadzer: updatedStudent.menadzer,
            schoolId: updatedStudent.occupation?.school?.id
        };

        res.status(200).json(result);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err });
    }
});
router.delete('/:id', async (req, res) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const { id } = req.params;

        // Validacija ID-a
        if (!id || isNaN(parseInt(id))) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                message: 'Nevalidan ID studenta'
            });
        }

        const studentId = parseInt(id);

        // Provera postojanja studenta
        const student = await queryRunner.manager.findOne(Student, {
            where: { id: studentId } as FindOptionsWhere<Student>
        });

        if (!student) {
            await queryRunner.rollbackTransaction();
            return res.status(404).json({
                success: false,
                message: 'Student nije pronađen'
            });
        }

        // 1. PRVO obrišite sve uplate studenta
        const deletePaymentsResult = await queryRunner.manager.delete(Payment, {
            student: { id: studentId } // Pretpostavljam da payment ima relaciju 'student'
        });

        console.log(`Obrisano ${deletePaymentsResult.affected} uplata studenta`);

        // 2. ONDA obrišite studenta
        await queryRunner.manager.remove(Student, student);

        console.log(student);

        // Potvrda transakcije
        await queryRunner.commitTransaction();

        // Uspešan odgovor
        res.status(200).json({
            success: true,
            message: 'Student i sve njegove uplate su uspešno obrisani',
            data: {
                id: studentId,
                name: student.ime,
                deletedPaymentsCount: deletePaymentsResult.affected
            }
        });

    } catch (error :any) {
        // Rollback u slučaju greške
        await queryRunner.rollbackTransaction();

        console.error('Greška pri brisanju studenta:', error);

        res.status(500).json({
            success: false,
            message: 'Došlo je do greške pri brisanju studenta',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        await queryRunner.release();
    }

});
// POST, PUT, DELETE…

router.get('/school', async (req, res) => {
    const studentService = new StudentService();

    try {
        const { page = 1, limit = 20 } = req.query;
        const {schoolId} = req.body; // Nakon schoolAccessMiddleware, sigurno postoji

        const result = await studentService.getStudentsForSchool(
            schoolId,
            Number(page),
            Number(limit)
        );

        res.json(result);
    } catch (error : any) {
        res.status(500).json({ message: error.message });
    }
});


export default router