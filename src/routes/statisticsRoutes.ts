import { Router } from 'express'
import { AppDataSource } from '../data-source'
import { School } from '../entity/School'
import { Occupation } from '../entity/Occupation'
import { Student } from '../entity/Student'
import { Between } from 'typeorm'

const router = Router()
const schoolRepo = AppDataSource.getRepository(School)
const occupationRepo = AppDataSource.getRepository(Occupation)
const studentRepo = AppDataSource.getRepository(Student)

// API za mesečnu statistiku upisa po školama i smerovima
router.get('/monthly-enrollment', async (req, res) => {
    try {
        const { year } = req.query;

        if (!year) {
            return res.status(400).json({ error: 'Godina je obavezna' });
        }

        const targetYear = parseInt(year as string);
        const startDate = new Date(targetYear, 0, 1); // 1. januar
        const endDate = new Date(targetYear, 11, 31); // 31. decembar

        // Dobij sve škole sa svojim smerovima
        const schools = await schoolRepo.find({
            relations: ['occupations'],
        });

        const result = [];

        for (const school of schools) {
            const schoolData: any = {
                schoolId: school.id,
                schoolName: school.name,
                monthlyStats: {},
                totalEnrollment: 0
            };

            // Inicijalizuj mesečnu statistiku za celu godinu
            const monthlyStats: {[month: string]: {[occupationId: string]: number}} = {};
            for (let month = 1; month <= 12; month++) {
                const monthKey = `${month.toString().padStart(2, '0')}`;
                monthlyStats[monthKey] = {};

                // Inicijalizuj za svaki smer u školi
                for (const occupation of school.occupations) {
                    monthlyStats[monthKey][occupation.id] = 0;
                }
            }

            // Za svaki smer u školi
            for (const occupation of school.occupations) {
                // Dobij sve studente za ovaj smer u target godini
                const students = await studentRepo.find({
                    where: {
                        occupation: { id: occupation.id },
                        createdAt: Between(startDate, endDate)
                    },
                    relations: ['occupation']
                });

                // Grupiši studente po mesecima
                for (const student of students) {
                    const month = (student.createdAt.getMonth() + 1).toString().padStart(2, '0');

                    if (!monthlyStats[month]) {
                        monthlyStats[month] = {};
                    }

                    monthlyStats[month][occupation.id] = (monthlyStats[month][occupation.id] || 0) + 1;
                    schoolData.totalEnrollment++;
                }
            }

            schoolData.monthlyStats = monthlyStats;
            schoolData.occupations = school.occupations.map(occ => ({
                id: occ.id,
                name: occ.name
            }));

            result.push(schoolData);
        }

        res.json(result);
    } catch (error) {
        console.error('Greška pri dobavljanju statistike:', error);
        res.status(500).json({ error: 'Interna greška servera' });
    }
});

// Alternativni API - statistika po mesecima sa agregiranim podacima
router.get('/monthly-enrollment-aggregated', async (req, res) => {
    try {
        const { year } = req.query;

        if (!year) {
            return res.status(400).json({ error: 'Godina je obavezna' });
        }

        const targetYear = parseInt(year as string);
        const startDate = new Date(targetYear, 0, 1);
        const endDate = new Date(targetYear, 11, 31);

        const schools = await schoolRepo.find({
            relations: ['occupations', 'occupations.students'],
        });

        const result = [];

        for (const school of schools) {
            const schoolData: any = {
                schoolId: school.id,
                schoolName: school.name,
                months: [],
                occupations: []
            };

            // Pripremi podatke za svaki mesec
            const monthlyData = [];
            for (let month = 1; month <= 12; month++) {
                const monthData: any = {
                    month: month.toString().padStart(2, '0'),
                    monthName: getMonthName(month),
                    total: 0,
                    byOccupation: {}
                };

                // Za svaki smer u školi
                for (const occupation of school.occupations) {
                    const count = occupation.students.filter(student => {
                        const studentDate = new Date(student.createdAt);
                        return studentDate.getFullYear() === targetYear &&
                            studentDate.getMonth() + 1 === month;
                    }).length;

                    monthData.byOccupation[occupation.id] = count;
                    monthData.total += count;
                }

                monthlyData.push(monthData);
            }

            schoolData.months = monthlyData;
            schoolData.occupations = school.occupations.map(occ => ({
                id: occ.id,
                name: occ.name
            }));

            result.push(schoolData);
        }

        res.json({
            schools: result,
            availableYears:getAvailableYearsForSchool(schools.flatMap(m => m.occupations))
        });
    } catch (error) {
        console.error('Greška pri dobavljanju statistike:', error);
        res.status(500).json({ error: 'Interna greška servera' });
    }
});

// API za očekivane uplate po mesecima
router.get('/expected-payments', async (req, res) => {
    try {
        const { year } = req.query;

        if (!year) {
            return res.status(400).json({ error: 'Godina je obavezna' });
        }

        const targetYear = parseInt(year as string);
        const startDate = new Date(targetYear, 0, 1);
        const endDate = new Date(targetYear, 11, 31);

        // Dobij sve studente za target godinu
        const students = await studentRepo.find({
            where: {
                createdAt: Between(startDate, endDate)
            },
            relations: ['payments', 'occupation', 'occupation.school', 'menadzer']
        });

        const result = [];

        // Grupiši studente po mesecu upisa
        for (let month = 1; month <= 12; month++) {
            const monthKey = `${month.toString().padStart(2, '0')}`;
            const monthName = getMonthName(month);

            const monthStart = new Date(targetYear, month - 1, 1);
            const monthEnd = new Date(targetYear, month, 0); // Poslednji dan u mesecu

            // Filtriraj studente upisane u ovom mesecu
            const studentsInMonth = students.filter(student => {
                const studentDate = new Date(student.createdAt);
                return studentDate.getMonth() + 1 === month;
            });

            const monthData: any = {
                month: monthKey,
                monthName: monthName,
                totalExpected: 0,
                totalPaid: 0,
                totalRemaining: 0,
                bySchool: {},
                byOccupation: {},
                byManager: {}
            };

            // Za svakog studenta u mesecu
            for (const student of studentsInMonth) {
                const totalPaid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                const remainingAmount = Number(student.cenaSkolarine) - totalPaid;

                monthData.totalExpected += Number(student.cenaSkolarine);
                monthData.totalPaid += totalPaid;
                monthData.totalRemaining += remainingAmount;

                // Grupiši po školi
                if (student.occupation && student.occupation.school) {
                    const schoolId = student.occupation.school.id;
                    const schoolName = student.occupation.school.name;

                    if (!monthData.bySchool[schoolId]) {
                        monthData.bySchool[schoolId] = {
                            name: schoolName,
                            expected: 0,
                            paid: 0,
                            remaining: 0
                        };
                    }

                    monthData.bySchool[schoolId].expected += Number(student.cenaSkolarine);
                    monthData.bySchool[schoolId].paid += totalPaid;
                    monthData.bySchool[schoolId].remaining += remainingAmount;
                }

                // Grupiši po smeru
                if (student.occupation) {
                    const occupationId = student.occupation.id;
                    const occupationName = student.occupation.name;

                    if (!monthData.byOccupation[occupationId]) {
                        monthData.byOccupation[occupationId] = {
                            name: occupationName,
                            expected: 0,
                            paid: 0,
                            remaining: 0
                        };
                    }

                    monthData.byOccupation[occupationId].expected += Number(student.cenaSkolarine);
                    monthData.byOccupation[occupationId].paid += totalPaid;
                    monthData.byOccupation[occupationId].remaining += remainingAmount;
                }

                // Grupiši po menadžeru
                if (student.menadzer) {
                    const managerId = student.menadzer.id;
                    const managerName = `${student.menadzer.ime} ${student.menadzer.prezime}`;

                    if (!monthData.byManager[managerId]) {
                        monthData.byManager[managerId] = {
                            name: managerName,
                            expected: 0,
                            paid: 0,
                            remaining: 0
                        };
                    }

                    monthData.byManager[managerId].expected += Number(student.cenaSkolarine);
                    monthData.byManager[managerId].paid += totalPaid;
                    monthData.byManager[managerId].remaining += remainingAmount;
                }
            }

            result.push(monthData);
        }

        res.json(result);
    } catch (error) {
        console.error('Greška pri dobavljanju očekivanih uplata:', error);
        res.status(500).json({ error: 'Interna greška servera' });
    }
});

// API za detaljne očekivane uplate po studentima
router.get('/expected-payments-details', async (req, res) => {
    try {
        const { year, month } = req.query;

        if (!year) {
            return res.status(400).json({ error: 'Godina je obavezna' });
        }

        const targetYear = parseInt(year as string);
        const targetMonth = month ? parseInt(month as string) : null;

        let startDate, endDate;
        if (targetMonth) {
            startDate = new Date(targetYear, targetMonth - 1, 1);
            endDate = new Date(targetYear, targetMonth, 0);
        } else {
            startDate = new Date(targetYear, 0, 1);
            endDate = new Date(targetYear, 11, 31);
        }

        // Dobij sve studente za target period
        const students = await studentRepo.find({
            where: {
                createdAt: Between(startDate, endDate)
            },
            relations: ['payments', 'occupation', 'occupation.school', 'menadzer']
        });

        const result = students.map(student => {
            const totalPaid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
            const remainingAmount = Number(student.cenaSkolarine) - totalPaid;

            return {
                studentId: student.id,
                studentName: `${student.ime} ${student.prezime}`,
                school: student.occupation?.school?.name || 'Nepoznato',
                occupation: student.occupation?.name || 'Nepoznato',
                manager: student.menadzer ? `${student.menadzer.ime} ${student.menadzer.prezime}` : 'Nepoznato',
                totalAmount: Number(student.cenaSkolarine),
                paidAmount: totalPaid,
                remainingAmount: remainingAmount,
                paymentStatus: remainingAmount === 0 ? 'Plaćeno' : remainingAmount === Number(student.cenaSkolarine) ? 'Nije plaćeno' : 'Delimično plaćeno',
                createdAt: student.createdAt
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Greška pri dobavljanju detalja očekivanih uplata:', error);
        res.status(500).json({ error: 'Interna greška servera' });
    }
});

// Pomocna funkcija za ime meseca
function getMonthName(month: number): string {
    const months = [
        'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
        'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
    ];
    return months[month - 1];
}

function getAvailableYearsForSchool(occupation: Occupation[]): number[] {
    const years = new Set<number>();
    console.log(occupation);
    occupation?.forEach((occ)=>{
        occ?.students.forEach((student:any) => {
            const year = new Date(student.createdAt).getFullYear();
            years.add(year);
        });
    })


    return Array.from(years).sort((a, b) => b - a); // Sortiraj opadajuće
}

export default router;