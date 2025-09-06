// src/routes/menadzerRoutes.ts
import { Router, Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import { Menadzer } from '../entity/Menadzer'
import {ManagerPayment} from "../entity/ManagerPayment";
import {FindOptionsWhere, Like} from "typeorm";
import {Student} from "../entity/Student";
import {
    filterStudentsByRange,
    filterStudentsByRangeAndYear,
    getAvailableYears,
    getDetailedStats
} from "../utiles/ManagerFunctions";
import {Payment} from "../entity/Payment";

const router = Router()
const menadzerRepo = AppDataSource.getRepository(Menadzer)
const managerPaymentRepo = AppDataSource.getRepository(ManagerPayment);

router.get('/', async (req, res) => {
    const range = req.query.range as string;
    const year = req.query.year as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    try {
        // Kreiraj where uslove za pretragu
        const whereConditions = search ? [
            { ime: Like(`%${search}%`) },
            { prezime: Like(`%${search}%`) }
        ] : {};

        if (range || year) {
            // Statistički prikaz - dohvati sve za statistike
            const menadzeri = await menadzerRepo.find({
                relations: ['students', 'isplate'],
                ...(search && { where: whereConditions })
            });

            const result = menadzeri.map((menadzer) => {
                const filteredStudents = filterStudentsByRangeAndYear(menadzer.students, range, year);
                return {
                    managerId: menadzer.id,
                    managerName: `${menadzer.ime} ${menadzer.prezime}`,
                    studentCount: filteredStudents.length,
                    totalRevenue: filteredStudents.reduce((sum, student) =>
                        Number(sum) + Number(student.cenaSkolarine), 0),
                    stats: getDetailedStats(filteredStudents, range, year)
                };
            });

            const sortedResult = result.sort((a, b) => b.studentCount - a.studentCount);

            // Straničenje za statistike (nakon filtriranja)
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedResult = sortedResult.slice(startIndex, endIndex);

            res.json({
                managers: paginatedResult,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(sortedResult.length / limit),
                    totalItems: sortedResult.length,
                    itemsPerPage: limit,
                    hasNextPage: endIndex < sortedResult.length,
                    hasPreviousPage: page > 1
                },
                availableYears: getAvailableYears(menadzeri.flatMap(m => m.students))
            });
        } else {
            // Obični prikaz sa findAndCount za efikasniju paginaciju
            const [menadzeri, totalItems] = await menadzerRepo.findAndCount({
                relations: ['students', 'isplate'],
                ...(search && { where: whereConditions }),
                skip: (page - 1) * limit,
                take: limit,
                order: { id: 'ASC' } // ili bilo koji drugi sort
            });

            const result = menadzeri.map(m => ({
                id: m.id,
                ime: m.ime,
                prezime: m.prezime,
                datumKreiranja: m.datumKreiranja,
                datumIzmene: m.datumIzmene,
                students: m.students,
                studentsCount: m.students.length,
            }));

            const totalPages = Math.ceil(totalItems / limit);

            res.json({
                managers: result,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalItems: totalItems,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            });
        }
    } catch (error) {
        console.error('Greška pri dohvatanju menadžera:', error);
        res.status(500).json({ error: 'Greška servera' });
    }
});

router.post('/', async (req, res) => {
    try {
        if (Array.isArray(req.body)) {
            return res.status(400).json({ error: 'Očekivan je objekat menadžera, a ne niz' });
        }

        const novi = menadzerRepo.create(req.body);
        const sacuvan = await menadzerRepo.save(novi);

        const menadzer = Array.isArray(sacuvan) ? sacuvan[0] : sacuvan;

        const menadzerSaStudentima = await menadzerRepo.findOne({
            where: { id: menadzer.id },
            relations: ['students']
        });

        if (!menadzerSaStudentima) {
            return res.status(404).json({ error: 'Menadžer nije pronađen' });
        }

        const result = {
            id: menadzerSaStudentima.id,
            ime: menadzerSaStudentima.ime,
            prezime: menadzerSaStudentima.prezime,
            datumKreiranja: menadzerSaStudentima.datumKreiranja,
            datumIzmene: menadzerSaStudentima.datumIzmene,
            students: menadzerSaStudentima.students,
            studentsCount: menadzerSaStudentima.students.length,
        };

        res.status(201).json(result);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Neispravni podaci za menadžera' });
    }
});
router.patch('/:id', async (req, res) => {
    try {
        const menadzerId = parseInt(req.params.id);



        const updateResult = await menadzerRepo.update(menadzerId, req.body);

        if (updateResult.affected === 0) {
            return res.status(404).json({ error: 'Menadžer nije pronađen' });
        }

        const updatedManager = await menadzerRepo.findOne({
            where: { id: menadzerId },
            relations: ['students']
        });

        if (!updatedManager) {
            return res.status(404).json({ message: 'Menadžer nije pronađen' });
        }

        const result = {
            id: updatedManager.id,
            ime: updatedManager.ime,
            prezime: updatedManager.prezime,
            datumKreiranja: updatedManager.datumKreiranja,
            datumIzmene: updatedManager.datumIzmene,
            students: updatedManager.students,
            studentsCount: updatedManager.students.length,
        };

        res.status(200).json(result);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Neispravni podaci za menadžera' });
    }
});
router.get('/isplate/:id', async (req, res) => {
    try {
        const managerId = parseInt(req.params.id);

        const isplate = await managerPaymentRepo.find({
            where : {
                menadzer : { id : managerId}
            },
            relations: ['menadzer', 'student']
        })

        if (!isplate || isplate.length === 0) {
            return res.status(404).json({ message: 'Nema pronađenih isplata za ovog menadžera' });
        }

        return res.status(200).json(isplate);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Došlo je do greške pri dobavljanju isplata' });
    }
});
router.get('/zarade', async (req, res) => {
    try {
        const godina = req.query.range as string;

        const menadzeriSaIsplatama = await menadzerRepo.find({
            relations: ['students', 'isplate']
        })


        const results = menadzeriSaIsplatama.map((x) => {
            const zaradaPoUceniku = x.students.map(y => {
                const ukupnaZarada = Number(y.cenaSkolarine) * (Number(y.procenatManagera) / 100);

                // FILTRIRAJTE ISPLATE SAMO ZA OVOG UČENIKA (y.id)
                const placenoZaUcenika = x.isplate && Array.isArray(x.isplate)
                    ? x.isplate
                        .filter(z => z.studentId === y.id) // OVO JE KLJUČNO - filtriraj po učeniku
                        .reduce((sum, z) => sum + Number(z.amount || 0), 0)
                    : 0;

                console.log(`Učenik ${y.ime} ${y.prezime}: Zarada=${ukupnaZarada}, Plaćeno=${placenoZaUcenika}`);

                let statusPlacanja;
                if (placenoZaUcenika === 0) {
                    statusPlacanja = 'nije_placeno';
                } else if (placenoZaUcenika < ukupnaZarada) {
                    statusPlacanja = 'delimicno_placeno';
                } else {
                    statusPlacanja = 'u_punosti_placeno';
                }

                return {
                    idUcenika: y.id,
                    imeIPrezimeUcenika: y.ime + ' ' + y.prezime,
                    zarada: ukupnaZarada,
                    placeno: statusPlacanja,
                    placeniIznos: placenoZaUcenika,
                    preostalo: ukupnaZarada - placenoZaUcenika
                };
            }).sort((a, b) => b.zarada - a.zarada);
            const ukupnaZarada = zaradaPoUceniku.reduce((sum, ucenik) => sum + ucenik.zarada, 0);
            const ukupnoPlaceno = zaradaPoUceniku.reduce((sum, ucenik) => sum + ucenik.placeniIznos, 0);

            return {
                id: x.id,
                name: x.ime + ' ' + x.prezime,
                brojStudenata: x.students.length,
                zaradaPoUceniku: zaradaPoUceniku,
                zarada: ukupnaZarada,
                ukupnoPlaceno: ukupnoPlaceno,
                ukupnoPreostalo: ukupnaZarada - ukupnoPlaceno
            };
        });

        const sortedResult = results.sort((a, b) => b.zarada - a.zarada);


        if (!menadzeriSaIsplatama || menadzeriSaIsplatama.length === 0) {
            return res.status(404).json({ message: 'Nema pronađenih menadzera' });
        }

        return res.status(200).json(sortedResult);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Došlo je do greške pri dobavljanju isplata' });
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

        const menadzerId = parseInt(id);

        // Provera postojanja studenta
        const menadzer = await queryRunner.manager.findOne(Menadzer, {
            where: { id: menadzerId } as FindOptionsWhere<Menadzer>
        });

        if (!menadzer) {
            await queryRunner.rollbackTransaction();
            return res.status(404).json({
                success: false,
                message: 'Menadzer nije pronađen'
            });
        }

        // 1. PRVO obrišite sve uplate studenta
        const deletePaymentsResult = await queryRunner.manager.delete(ManagerPayment, {
            student: { id: menadzerId } // Pretpostavljam da payment ima relaciju 'student'
        });

        console.log(`Obrisano ${deletePaymentsResult.affected} uplata studenta`);

        // 2. ONDA obrišite studenta
        await queryRunner.manager.remove(Menadzer, menadzer);

        // Potvrda transakcije
        await queryRunner.commitTransaction();

        // Uspešan odgovor
        res.status(200).json({
            success: true,
            message: 'Menadzer i sve njegove uplate su uspešno obrisani',
            data: {
                id: menadzerId,
                name: menadzer.ime,
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
export default router