import { Router } from "express";
import { AppDataSource } from "../data-source";
import { School } from "../entity/School";
import { Occupation } from "../entity/Occupation";
import { Student } from "../entity/Student";
import { Between, Like } from "typeorm";
import { Payment } from "../entity/Payment";
import { ManagerPayment } from "../entity/ManagerPayment";
import {
  getSchoolYearRange,
  getSchoolYearForDate,
  getSchoolYearLabel,
  getSchoolYearMonths,
} from "../utiles/schoolYear";

const router = Router();

/**
 * Godina stiže iz URL-a. Nevalidna vrednost pravi "Invalid Date" koji
 * obara SQL upit, pa se odbija pre nego što dođe do baze.
 */
function jeValidnaSkolskaGodina(godina: number): boolean {
  return Number.isInteger(godina) && godina >= 1900 && godina <= 2200;
}

const schoolRepo = AppDataSource.getRepository(School);
const occupationRepo = AppDataSource.getRepository(Occupation);
const studentRepo = AppDataSource.getRepository(Student);
const paymentRepo = AppDataSource.getRepository(Payment);
const managerPaymentRepo = AppDataSource.getRepository(ManagerPayment);

// API za mesečnu statistiku upisa po školama i smerovima
router.get("/monthly-enrollment", async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ error: "Godina je obavezna" });
    }

    // year = početna godina školske godine (npr. 2025 = školska 2025/26)
    const targetYear = parseInt(year as string);
    const { start: startDate, end: endDate } = getSchoolYearRange(targetYear);

    // Dobij sve škole sa svojim smerovima
    const schools = await schoolRepo.find({
      relations: ["occupations.students"],
    });

    const result = [];

    for (const school of schools) {
      const schoolData: any = {
        schoolId: school.id,
        schoolName: school.name,
        monthlyStats: {},
        totalEnrollment: 0,
      };

      // Inicijalizuj mesečnu statistiku za celu školsku godinu (septembar -> avgust)
      const monthlyStats: {
        [month: string]: { [occupationId: string]: number };
      } = {};
      for (const { month, year: calYear } of getSchoolYearMonths(targetYear)) {
        const monthKey = `${calYear}-${month.toString().padStart(2, "0")}`;
        monthlyStats[monthKey] = {};

        // Inicijalizuj za svaki smer u školi
        for (const occupation of school.occupations) {
          monthlyStats[monthKey][occupation.id] = 0;
        }
      }

      // Za svaki smer u školi
      for (const occupation of school.occupations) {
        // Dobij sve studente za ovaj smer u target školskoj godini
        const students = await studentRepo.find({
          where: {
            occupation: { id: occupation.id },
            createdAt: Between(startDate, endDate),
          },
          relations: ["occupation"],
        });

        // Grupiši studente po mesecima
        for (const student of students) {
          const monthKey = `${student.createdAt.getFullYear()}-${(
            student.createdAt.getMonth() + 1
          )
            .toString()
            .padStart(2, "0")}`;

          if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {};
          }

          monthlyStats[monthKey][occupation.id] =
            (monthlyStats[monthKey][occupation.id] || 0) + 1;
          schoolData.totalEnrollment++;
        }
      }

      schoolData.monthlyStats = monthlyStats;
      schoolData.occupations = school.occupations.map((occ) => ({
        id: occ.id,
        name: occ.name,
      }));

      result.push(schoolData);
    }

    res.json(result);
  } catch (error) {
    console.error("Greška pri dobavljanju statistike:", error);
    res.status(500).json({ error: "Interna greška servera" });
  }
});

// Alternativni API - statistika po mesecima sa agregiranim podacima
router.get("/monthly-enrollment-aggregated", async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ error: "Godina je obavezna" });
    }

    // year = početna godina školske godine (npr. 2025 = školska 2025/26)
    const targetYear = parseInt(year as string);

    const schools = await schoolRepo.find({
      relations: ["occupations", "occupations.students"],
    });

    const result = [];

    for (const school of schools) {
      const schoolData: any = {
        schoolId: school.id,
        schoolName: school.name,
        months: [],
        occupations: [],
      };

      // Pripremi podatke za svaki mesec školske godine (septembar -> avgust)
      const monthlyData = [];
      for (const { month, year: calYear } of getSchoolYearMonths(targetYear)) {
        const monthData: any = {
          month: month.toString().padStart(2, "0"),
          monthName: `${getMonthName(month)} ${calYear}.`,
          total: 0,
          byOccupation: {},
          studentsByOccupation: {},
        };

        // Za svaki smer u školi
        for (const occupation of school.occupations) {
          const students = occupation.students.filter((student) => {
            const studentDate = new Date(student.createdAt);
            return (
              studentDate.getFullYear() === calYear &&
              studentDate.getMonth() + 1 === month
            );
          });
          const count = students.length;
          monthData.byOccupation[occupation.id] = count;
          monthData.studentsByOccupation[occupation.id] = students;
          monthData.total += count;
        }

        monthlyData.push(monthData);
      }

      schoolData.months = monthlyData;
      schoolData.occupations = school.occupations.map((occ) => ({
        id: occ.id,
        name: occ.name,
        totalStudentsPerYear: occ.students.filter((occ2) => {
          return (
            getSchoolYearForDate(new Date(occ2.createdAt)) === targetYear
          );
        }),
      }));

      result.push(schoolData);
    }

    res.json({
      schools: result,
      availableYears: getAvailableYearsForSchool(
        schools.flatMap((m) => m.occupations)
      ),
    });
  } catch (error) {
    console.error("Greška pri dobavljanju statistike:", error);
    res.status(500).json({ error: "Interna greška servera" });
  }
});

// API za očekivane uplate po mesecima


///OVO OVDE JE PROBLEM
router.get("/expected-payments", async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ error: "Godina je obavezna" });
    }

    // year = početna godina školske godine (npr. 2025 = školska 2025/26)
    const targetYear = parseInt(year as string);
    if (!jeValidnaSkolskaGodina(targetYear)) {
      return res.status(400).json({ error: "Nevalidna školska godina" });
    }
    const { start: startDate, end: endDate } = getSchoolYearRange(targetYear);

    // Dobij sve studente za target školsku godinu
    const students = await studentRepo.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      relations: ["payments", "occupation", "occupation.school", "menadzer"],
    });

    const result = [];

    // Grupiši studente po mesecu upisa (septembar -> avgust)
    for (const { month, year: calYear } of getSchoolYearMonths(targetYear)) {
      const monthKey = `${month.toString().padStart(2, "0")}`;
      const monthName = `${getMonthName(month)} ${calYear}.`;

      // Filtriraj studente upisane u ovom mesecu
      const studentsInMonth = students.filter((student) => {
        const studentDate = new Date(student.createdAt);
        return (
          studentDate.getFullYear() === calYear &&
          studentDate.getMonth() + 1 === month
        );
      });

      const monthData: any = {
        month: monthKey,
        monthName: monthName,
        totalExpected: 0,
        totalPaid: 0,
        totalRemaining: 0,
        bySchool: {},
        byOccupation: {},
        byManager: {},
      };

      // Za svakog studenta u mesecu
      for (const student of studentsInMonth) {
        const totalPaid = student.payments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0
        );
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
              remaining: 0,
            };
          }

          monthData.bySchool[schoolId].expected += Number(
            student.cenaSkolarine
          );
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
              remaining: 0,
            };
          }

          monthData.byOccupation[occupationId].expected += Number(
            student.cenaSkolarine
          );
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
              remaining: 0,
            };
          }

          monthData.byManager[managerId].expected += Number(
            student.cenaSkolarine
          );
          monthData.byManager[managerId].paid += totalPaid;
          monthData.byManager[managerId].remaining += remainingAmount;
        }
      }
      if (Object.keys(monthData.byManager).length > 0) {
        const sortedEntries = Object.entries(monthData.byManager).sort(
          (a: any, b: any) => b[1].paid - a[1].paid
        );

        // Kreiraj novi objekat - Node.js će zadržati redosled za string ključeve
        const newObject: any = {};

        sortedEntries.forEach(([key, value]) => {
          newObject[key] = value;
        });

        monthData.byManager = newObject;
      }
      result.push(monthData);
    }
    res.json(result);
  } catch (error) {
    console.error("Greška pri dobavljanju očekivanih uplata:", error);
    res.status(500).json({ error: "Interna greška servera" });
  }
});

// API za detaljne očekivane uplate po studentima
router.get("/expected-payments-details", async (req, res) => {
  try {
    const {
      year,
      month,
      page = "1",
      limit = "10",
      studentName = "",
      status = "",
    } = req.query;

    if (!year) {
      return res.status(400).json({ error: "Godina je obavezna" });
    }

    const targetYear = parseInt(year as string);
    const targetMonth = month ? parseInt(month as string) : null;
    const currentPage = parseInt(page as string);
    const itemsPerPage = parseInt(limit as string);
    const searchName = (studentName as string).trim();
    const searchStatus = status as string;

    // targetYear = početna godina školske godine (npr. 2025 = školska 2025/26)
    if (!jeValidnaSkolskaGodina(targetYear)) {
      return res.status(400).json({ error: "Nevalidna školska godina" });
    }
    if (targetMonth !== null && (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12)) {
      return res.status(400).json({ error: "Nevalidan mesec" });
    }

    let startDate, endDate;
    if (targetMonth) {
      // Септембар-decembar pripadaju početnoj godini, januar-avgust narednoj
      const calYear = targetMonth >= 9 ? targetYear : targetYear + 1;
      startDate = new Date(calYear, targetMonth - 1, 1);
      endDate = new Date(calYear, targetMonth, 0, 23, 59, 59, 999);
    } else {
      const range = getSchoolYearRange(targetYear);
      startDate = range.start;
      endDate = range.end;
    }

    // Prvo dobijamo sve studente koji zadovoljavaju osnovne uslove
    const queryBuilder = studentRepo
      .createQueryBuilder("student")
      .leftJoinAndSelect("student.payments", "payments")
      .leftJoinAndSelect("student.occupation", "occupation")
      .leftJoinAndSelect("occupation.school", "school")
      .leftJoinAndSelect("student.menadzer", "menadzer")
      .where("student.createdAt BETWEEN :startDate AND :endDate", {
        startDate,
        endDate,
      });

    // Dodaj pretragu po imenu ako je unesena
    if (searchName) {
      queryBuilder.andWhere(
        "(student.ime LIKE :name OR student.prezime LIKE :name)",
        { name: `%${searchName}%` }
      );
    }

    const allStudents = await queryBuilder.getMany();

    // Obradi podatke i primeni status filter
    let filteredStudents = allStudents.map((student) => {
      const totalPaid = student.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      );
      const remainingAmount = Number(student.cenaSkolarine) - totalPaid;

      let paymentStatus;
      if (remainingAmount === 0) {
        paymentStatus = "Плаћено";
      } else if (remainingAmount === Number(student.cenaSkolarine)) {
        paymentStatus = "Није плаћено";
      } else {
        paymentStatus = "Делимично";
      }

      return {
        studentId: student.id,
        studentName: `${student.ime} ${student.prezime}`,
        school: student.occupation?.school?.name || "Непознато",
        occupation: student.occupation?.name || "Непознато",
        manager: student.menadzer
          ? `${student.menadzer.ime} ${student.menadzer.prezime}`
          : "Непознато",
        totalAmount: Number(student.cenaSkolarine),
        paidAmount: totalPaid,
        remainingAmount: remainingAmount,
        paymentStatus: paymentStatus,
        createdAt: student.createdAt,
      };
    });

    // Filtriraj po statusu ako je izabran
    if (searchStatus && searchStatus !== "Svi") {
      filteredStudents = filteredStudents.filter(
        (student) => student.paymentStatus === searchStatus
      );
    }

    const totalItems = filteredStudents.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Primena paginacije
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const result = filteredStudents.slice(startIndex, endIndex);

    res.json({
      data: result,
      pagination: {
        currentPage: currentPage,
        totalPages: totalPages,
        totalItems: totalItems,
        itemsPerPage: itemsPerPage,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (error) {
    console.error("Greška pri dobavljanju detalja očekivanih uplata:", error);
    res.status(500).json({ error: "Interna greška servera" });
  }
});
// Godišnji izveštaj: zbirno po školama za jednu školsku godinu (1.9. - 31.8.).
// Uplate i isplate se računaju po DATUMU NOVCA — sve što je naplaćeno ili
// isplaćeno unutar perioda, bez obzira kada je učenik upisan.
router.get("/godisnji-izvestaj", async (req, res) => {
  try {
    const { year } = req.query;

    const schoolYearStart = year
      ? parseInt(year as string)
      : getSchoolYearForDate(new Date());

    if (!jeValidnaSkolskaGodina(schoolYearStart)) {
      return res.status(400).json({ error: "Nevalidna školska godina" });
    }

    const { start: od, end: doDatum } = getSchoolYearRange(schoolYearStart);

    // Uplate učenika u periodu, grupisane po školi
    const uplate = await paymentRepo
      .createQueryBuilder("p")
      .leftJoin("p.student", "s")
      .leftJoin("s.occupation", "o")
      .leftJoin("o.school", "sc")
      .select("sc.id", "schoolId")
      .addSelect("SUM(p.amount)", "iznos")
      .addSelect("COUNT(p.id)", "broj")
      .where("p.paidAt BETWEEN :od AND :doDatum", { od, doDatum })
      .groupBy("sc.id")
      .getRawMany();

    // Isplate menadžerima u periodu, grupisane po školi učenika
    const isplate = await managerPaymentRepo
      .createQueryBuilder("mp")
      .leftJoin("mp.student", "s")
      .leftJoin("s.occupation", "o")
      .leftJoin("o.school", "sc")
      .select("sc.id", "schoolId")
      .addSelect("SUM(mp.amount)", "iznos")
      .addSelect("COUNT(mp.id)", "broj")
      .where("mp.paidAt BETWEEN :od AND :doDatum", { od, doDatum })
      .groupBy("sc.id")
      .getRawMany();

    // Naplaćena literatura u periodu (vodi se odvojeno od školarine)
    const literatura = await studentRepo
      .createQueryBuilder("s")
      .leftJoin("s.occupation", "o")
      .leftJoin("o.school", "sc")
      .select("sc.id", "schoolId")
      .addSelect("SUM(s.literature)", "iznos")
      .addSelect("COUNT(s.id)", "broj")
      .where("s.literaturePaidAt BETWEEN :od AND :doDatum", { od, doDatum })
      .groupBy("sc.id")
      .getRawMany();

    // Generacija upisana te školske godine: koliko ih je i koliko je zaduženo.
    // Ovo je vezano za UČENIKE upisane u periodu, za razliku od kolona iznad
    // koje prate NOVAC koji se kretao u periodu.
    const upisani = await studentRepo
      .createQueryBuilder("s")
      .leftJoin("s.occupation", "o")
      .leftJoin("o.school", "sc")
      .select("sc.id", "schoolId")
      .addSelect("COUNT(s.id)", "broj")
      .addSelect("SUM(s.cenaSkolarine)", "zaduzeno")
      .where("s.createdAt BETWEEN :od AND :doDatum", { od, doDatum })
      .groupBy("sc.id")
      .getRawMany();

    // Koliko je ta generacija do sada uplatila (bez obzira kada je uplaćeno)
    const naplacenoOdGeneracije = await paymentRepo
      .createQueryBuilder("p")
      .leftJoin("p.student", "s")
      .leftJoin("s.occupation", "o")
      .leftJoin("o.school", "sc")
      .select("sc.id", "schoolId")
      .addSelect("SUM(p.amount)", "iznos")
      .where("s.createdAt BETWEEN :od AND :doDatum", { od, doDatum })
      .groupBy("sc.id")
      .getRawMany();

    const nadji = (niz: any[], schoolId: number) =>
      niz.find((r) => Number(r.schoolId) === schoolId);

    const schools = await schoolRepo.find({ order: { name: "ASC" } });

    const redovi = schools.map((school) => {
      const u = nadji(uplate, school.id);
      const i = nadji(isplate, school.id);
      const l = nadji(literatura, school.id);
      const up = nadji(upisani, school.id);
      const ng = nadji(naplacenoOdGeneracije, school.id);

      const uplaceno = Number(u?.iznos || 0);
      const isplaceno = Number(i?.iznos || 0);
      const zaduzeno = Number(up?.zaduzeno || 0);
      const naplaceno = Number(ng?.iznos || 0);

      return {
        schoolId: school.id,
        schoolName: school.name,
        brojUpisanih: Number(up?.broj || 0),
        uplaceno: parseFloat(uplaceno.toFixed(2)),
        brojUplata: Number(u?.broj || 0),
        isplacenoMenadzerima: parseFloat(isplaceno.toFixed(2)),
        brojIsplata: Number(i?.broj || 0),
        literaturaNaplacena: Number(l?.iznos || 0),
        brojNaplacenihLiteratura: Number(l?.broj || 0),
        neto: parseFloat((uplaceno - isplaceno).toFixed(2)),
        // Podaci o generaciji upisanoj te godine
        zaduzeno: parseFloat(zaduzeno.toFixed(2)),
        naplacenoOdGeneracije: parseFloat(naplaceno.toFixed(2)),
        preostaloZaNaplatu: parseFloat(
          Math.max(0, zaduzeno - naplaceno).toFixed(2)
        ),
      };
    });

    const zbir = (polje: keyof (typeof redovi)[0]) =>
      redovi.reduce((suma, r) => suma + Number(r[polje] || 0), 0);

    // Školske godine za koje uopšte ima podataka (za padajući izbor)
    const rasponUpisa = await studentRepo
      .createQueryBuilder("s")
      .select("MIN(s.createdAt)", "min")
      .addSelect("MAX(s.createdAt)", "max")
      .getRawOne();

    const tekuca = getSchoolYearForDate(new Date());
    const availableSchoolYears: number[] = [];
    if (rasponUpisa?.min && rasponUpisa?.max) {
      const prva = getSchoolYearForDate(new Date(rasponUpisa.min));
      const poslednja = Math.max(
        getSchoolYearForDate(new Date(rasponUpisa.max)),
        tekuca
      );
      for (let g = poslednja; g >= prva; g--) availableSchoolYears.push(g);
    } else {
      availableSchoolYears.push(tekuca);
    }

    res.json({
      schoolYear: getSchoolYearLabel(schoolYearStart),
      schoolYearStart,
      availableSchoolYears,
      period: { od, do: doDatum },
      schools: redovi,
      ukupno: {
        brojUpisanih: zbir("brojUpisanih"),
        uplaceno: parseFloat(zbir("uplaceno").toFixed(2)),
        brojUplata: zbir("brojUplata"),
        isplacenoMenadzerima: parseFloat(zbir("isplacenoMenadzerima").toFixed(2)),
        brojIsplata: zbir("brojIsplata"),
        literaturaNaplacena: zbir("literaturaNaplacena"),
        brojNaplacenihLiteratura: zbir("brojNaplacenihLiteratura"),
        neto: parseFloat(zbir("neto").toFixed(2)),
        zaduzeno: parseFloat(zbir("zaduzeno").toFixed(2)),
        naplacenoOdGeneracije: parseFloat(zbir("naplacenoOdGeneracije").toFixed(2)),
        preostaloZaNaplatu: parseFloat(zbir("preostaloZaNaplatu").toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Greška pri izradi godišnjeg izveštaja:", error);
    res.status(500).json({ error: "Interna greška servera" });
  }
});

function getMonthName(month: number): string {
  const months = [
    "Јануар",
    "Фебруар",
    "Март",
    "Април",
    "Мај",
    "Јун",
    "Јул",
    "Август",
    "Септембар",
    "Октобар",
    "Новембар",
    "Децембар",
  ];
  return months[month - 1];
}

// Vraća dostupne ŠKOLSKE godine (početne godine, npr. 2025 = školska 2025/26)
function getAvailableYearsForSchool(occupation: Occupation[]): number[] {
  const years = new Set<number>();
  occupation?.forEach((occ) => {
    occ?.students.forEach((student: any) => {
      years.add(getSchoolYearForDate(new Date(student.createdAt)));
    });
  });

  return Array.from(years).sort((a, b) => b - a); // Sortiraj opadajuće
}

export default router;
