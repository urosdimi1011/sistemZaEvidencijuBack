// src/routes/studentRoutes.ts
// src/routes/studentRoutes.ts
import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Student } from "../entity/Student";
import { Between, FindOptionsWhere, ILike, IsNull, Not } from "typeorm";
import { object } from "yup";
import { Payment } from "../entity/Payment";
import { ManagerPayment } from "../entity/ManagerPayment";
import { Menadzer } from "../entity/Menadzer";
import { searchVariants } from "../utiles/transliterate";
import {
  buildStudentWhere,
  parsePagination,
  parseSortBy,
  parseSortOrder,
  parseSchoolId,
  parseSearch,
  parseDanOpseg,
} from "../utiles/studentFilters";
import {
  getSchoolYearForDate,
  getSchoolYearLabel,
  getSchoolYearRange,
} from "../utiles/schoolYear";
import { obracunUcenika } from "../utiles/obracun";

const router = Router();
const studentiRepo = AppDataSource.getRepository(Student);

// Vrsta upisa koju nalog obrađuje. Samo nalozi škole su vezani za vrstu;
// admin i računovođa vide sve, pa za njih vraća null.
function tipUpisaZaNalog(user: any): "redovni" | "vandredni" | null {
  if (user?.role !== "school_manager") return null;
  return user?.tipUpisa === "redovni" || user?.tipUpisa === "vandredni"
    ? user.tipUpisa
    : null;
}
const paymentRepo = AppDataSource.getRepository(Payment);

router.get("/", async (req, res) => {
  try {
    const requestUser = (req as any).user;

    // Obrada i provera svih parametara je izdvojena u utiles/studentFilters,
    // da bi mogla da se testira i da nevalidan unos ne obori upit
    const { page, limit, offset } = parsePagination(req.query);
    const finalSortBy = parseSortBy(req.query.sortBy);
    const sortOrder = parseSortOrder(req.query.sortOrder);

    // Nevalidan datum se odbija odmah, umesto da se tiho ignoriše
    if (
      typeof req.query.date === "string" &&
      req.query.date.trim() &&
      !parseDanOpseg(req.query.date)
    ) {
      return res
        .status(400)
        .json({ message: "Nevalidan format datuma. Koristite YYYY-MM-DD" });
    }

    const finalWhere = buildStudentWhere({
      search: req.query.search,
      date: req.query.date,
      type: req.query.type,
      schoolId: req.query.schoolId,
      schoolYear: req.query.schoolYear,
      napomena: req.query.napomena,
      user: requestUser,
    });

    const searchTerm = parseSearch(req.query.search);
    const datePicker =
      typeof req.query.date === "string" ? req.query.date.trim() : "";
    const schoolIdTerm = parseSchoolId(req.query.schoolId);

    const order: any = {};
    order[finalSortBy] = sortOrder;
    const [studenti, totalCount] = await studentiRepo.findAndCount({
      where: finalWhere,
      relations: [
        "menadzer",
        "payments",
        "managerPayouts",
        "occupation.school",
      ],
      order: order,
      take: limit,
      skip: offset,
    });

    const result = studenti.map((m) => {
      // Literatura se naplaćuje odvojeno i ne ulazi u cenu školovanja.
      // Preplata se ne prikazuje u minusu nego kao izmireno.
      const obracun = obracunUcenika(m);

      return {
        id: m.id,
        ime: m.ime,
        imeRoditelja: m.imeRoditelja,
        prezime: m.prezime,
        datumKreiranja: m?.createdAt,
        type: m?.type,
        entry_type: m?.entry_type,
        note: m?.note,
        noteHandled: !!m?.noteHandledAt,
        noteHandledAt: m?.noteHandledAt,
        createdAt: m?.createdAt,
        literature: m.literature ? true : false,
        zanimanje: m.occupation
          ? {
              name: m.occupation?.name,
              id: m.occupation?.id,
            }
          : null,
        cenaSkolarine: m.cenaSkolarine,
        literatureCost: m.literature || 0,
        literaturePaidAt: m.literaturePaidAt,
        literaturePaid: !!m.literaturePaidAt,
        ukupanDug: obracun.ukupanDug,
        preostaliDug: obracun.preostaliDug,
        preostaliDugZaMenadzera: obracun.preostaloMenadzeru,
        procenatMenadzeru: m.procenatManagera,
        menadzer: m.menadzer,
        schoolId: m.occupation?.school?.id,
      };
    });

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
        hasPrevPage: hasPrevPage,
      },
      filters: {
        search: searchTerm || null,
        date: datePicker || null,
        schoolId: schoolIdTerm,
      },
      sorting: {
        sortBy: finalSortBy,
        sortOrder: sortOrder,
      },
    });
  } catch (error) {
    console.error("Greška pri dobavljanju studenata:", error);
    res
      .status(500)
      .json({ message: "Došlo je do greške pri dobavljanju studenata" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    let schoolIdTerm = (req.query.schoolId as string)?.trim();

    const requestUser = (req as any).user;
    if (requestUser?.role === "school_manager" && requestUser?.schoolId) {
      schoolIdTerm = String(requestUser.schoolId);
    }
    let where: FindOptionsWhere<Student> = {};

    if (schoolIdTerm) {
      where = {
        occupation: {
          school: {
            id: Number(schoolIdTerm),
          },
        },
      };
    }

    // Brojač prati ono što nalog zaista vidi
    const tipUpisaNaloga = tipUpisaZaNalog(requestUser);
    if (tipUpisaNaloga) {
      where.type = tipUpisaNaloga;
    }

    // Broj učenika se računa za tekuću školsku godinu (1.9. - 31.8.),
    // brojanje kreće ispočetka svakog 1. septembra
    const schoolYearStart = getSchoolYearForDate(new Date());
    const { start: schoolYearFrom, end: schoolYearTo } =
      getSchoolYearRange(schoolYearStart);

    const totalCount = await studentiRepo.count({
      where: {
        ...where,
        createdAt: Between(schoolYearFrom, schoolYearTo),
      },
      relations: ["occupation.school"],
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayCount = await studentiRepo.count({
      where: {
        ...where,
        createdAt: Between(todayStart, todayEnd),
      },
      relations: ["occupation.school"],
    });

    // Školske godine za koje uopšte ima upisa (za birač iznad табеле)
    const rasponUpisa = await studentiRepo
      .createQueryBuilder("s")
      .select("MIN(s.createdAt)", "min")
      .addSelect("MAX(s.createdAt)", "max")
      .getRawOne();

    const availableSchoolYears: number[] = [];
    if (rasponUpisa?.min && rasponUpisa?.max) {
      const prva = getSchoolYearForDate(new Date(rasponUpisa.min));
      const poslednja = Math.max(
        getSchoolYearForDate(new Date(rasponUpisa.max)),
        schoolYearStart
      );
      for (let g = poslednja; g >= prva; g--) availableSchoolYears.push(g);
    } else {
      availableSchoolYears.push(schoolYearStart);
    }

    res.json({
      totalStudents: totalCount,
      todayStudents: todayCount,
      schoolYear: getSchoolYearLabel(schoolYearStart),
      schoolYearStart,
      availableSchoolYears,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Greška pri dobavljanju statistika:", error);
    res
      .status(500)
      .json({ message: "Došlo je do greške pri dobavljanju statistika" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const student = await studentiRepo.findOne({
      where: { id: studentId },
      relations: ["payments", "managerPayouts", "occupation.school"],
    });
    if (!student) {
      return res.status(404).json({ message: "Student nije pronađen" });
    }
    
    // Literatura se naplaćuje odvojeno i ne ulazi u cenu školovanja.
    // Dug se ne prikazuje u minusu nego kao izmireno, a višak kao preplata.
    const obracun = obracunUcenika(student);

    const totalDebt = obracun.ukupanDug;
    const totalPaid = obracun.uplaceno;
    const remainingAmount = obracun.preostaliDug;
    const preplata = obracun.preplata;
    const commissionAmount = obracun.provizijaMenadzera;
    const remainingForManager = obracun.preostaloMenadzeru;

    res.json({
      student: {
        id: student.id,
        ime: student.ime,
        prezime: student.prezime,
        imeRoditelja: student.imeRoditelja,
        zanimanje: student.occupation?.id,
        createdAt: student?.createdAt,
        ukupnaSkolarina: student.cenaSkolarine,
        ukupnoMenadzeru: commissionAmount,
        type: student?.type,
        entry_type: student?.entry_type,
        note: student?.note,
        noteHandled: !!student?.noteHandledAt,
        noteHandledAt: student?.noteHandledAt,
        literature: student.literature ? true : false,
        literatureCost: student.literature || 0,
        literaturePaidAt: student.literaturePaidAt,
        literaturePaid: !!student.literaturePaidAt,
        preostaloMenadzeru: remainingForManager,
        managerId: student.managerId,
        payments: {
          ukupanDug: totalDebt,
          totalPaid,
          remainingAmount,
          preplata,
          installments: student.payments,
        },
        managerPayments: {
          installments: student.managerPayouts,
        },
        schoolId: student.occupation?.school?.id,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Došlo je do greške pri dobavljanju studenata" });
  }
});

// Administracija škole (school_manager) ne sme sama da određuje procenat —
// dozvoljeno je 0% ili tačno onoliko koliko iznosi procenat izabranog menadžera
async function isValidPercentForSchoolManager(
  req: any,
  procenat: any,
  managerId: any
): Promise<boolean> {
  if (req.user?.role !== "school_manager") return true;
  if (procenat === null || procenat === undefined || procenat === "") return true;

  const unetiProcenat = Number(procenat);
  if (unetiProcenat === 0) return true;
  if (!managerId) return false;

  const menadzer = await AppDataSource.getRepository(Menadzer).findOne({
    where: { id: Number(managerId) },
  });

  return !!menadzer && unetiProcenat === menadzer.procenat;
}

router.post("/", async (req, res) => {
  try {
    const dozvoljenProcenat = await isValidPercentForSchoolManager(
      req,
      req.body?.procenatManagera,
      req.body?.managerId
    );
    if (!dozvoljenProcenat) {
      return res.status(400).json({
        error: {
          detail:
            "Procenat mora biti 0% ili procenat koji je određen za izabranog menadžera",
        },
      });
    }

    const dataForSend: any = object(req.body).fields;

    // Nalog vezan za vrstu upisa ne bira tip — nameće mu se prema nalogu.
    // Redovni učenici nemaju tip upisa ni literaturu.
    const tipUpisaNaloga = tipUpisaZaNalog((req as any).user);
    if (tipUpisaNaloga) {
      dataForSend.type = tipUpisaNaloga;
    }
    if (dataForSend.type === "redovni") {
      dataForSend.entry_type = null;
      dataForSend.literature = null;
    }

    const datum = dataForSend.createdAt as unknown as string;
    const podaciZaUpis = {
      ...dataForSend,
      literature: dataForSend.literature ? 50 : null,
      createdAt: dataForSend.createdAt ? new Date(datum) : new Date(),
    } as Student;
    const novi = studentiRepo.create(podaciZaUpis);
    const sacuvan = await studentiRepo.save(novi);
    let studentSaMenadzerom = await studentiRepo.findOne({
      where: { id: sacuvan.id },
      relations: ["menadzer", "payments", "managerPayouts", "occupation.school"],
    });

    if (!studentSaMenadzerom) {
      return res.status(404).json({ message: "Student nije pronađen" });
    }

    // Literatura se naplaćuje odvojeno i ne ulazi u cenu školovanja
    const preostaliDug = obracunUcenika(studentSaMenadzerom).preostaliDug;

    const result = {
      id: studentSaMenadzerom.id,
      ime: studentSaMenadzerom.ime,
      prezime: studentSaMenadzerom.prezime,
      datumKreiranja: studentSaMenadzerom?.createdAt,
      type: studentSaMenadzerom?.type,
      entry_type: studentSaMenadzerom?.entry_type,
      note: studentSaMenadzerom?.note,
      literature: studentSaMenadzerom.literature ? true : false,
      literatureCost: studentSaMenadzerom.literature || 0,
      literaturePaidAt: studentSaMenadzerom.literaturePaidAt,
      literaturePaid: !!studentSaMenadzerom.literaturePaidAt,
      imeRoditelja: studentSaMenadzerom.imeRoditelja,
      zanimanje: studentSaMenadzerom.occupation
        ? {
            name: studentSaMenadzerom.occupation.name,
            id: studentSaMenadzerom.occupation.id,
          }
        : null,
      cenaSkolarine: studentSaMenadzerom.cenaSkolarine,
      preostaliDug: preostaliDug,
      procenatMenadzeru: studentSaMenadzerom.procenatManagera,
      menadzer: studentSaMenadzerom.menadzer,
      schoolId: studentSaMenadzerom.occupation?.school?.id,
    };

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

router.patch("/:id", async (req, res) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const studentId = parseInt(req.params.id);
    const dataForSend = req.body;

    const dozvoljenProcenat = await isValidPercentForSchoolManager(
      req,
      dataForSend?.procenatManagera,
      dataForSend?.managerId
    );
    if (!dozvoljenProcenat) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        error: {
          detail:
            "Procenat mora biti 0% ili procenat koji je određen za izabranog menadžera",
        },
      });
    }

    const currentStudent = await queryRunner.manager.findOne(Student, {
      where: { id: studentId },
      relations: ["managerPayouts"],
    });

    if (!currentStudent) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({ error: "Student nije pronađen" });
    }

    const managerChanging =
      dataForSend.managerId !== undefined &&
      currentStudent.managerId !== dataForSend.managerId;

    if (managerChanging && currentStudent.managerPayouts.length > 0) {
      if (!req.query.confirmDeletePayouts) {
        await queryRunner.rollbackTransaction();
        return res.status(409).json({
          message:
            "Student ima isplate prethodnom menadžeru. Da li želite da ih obrišete?",
          managerPayouts: currentStudent.managerPayouts,
          needsConfirmation: true,
          totalAmount: currentStudent.managerPayouts.reduce(
            (sum, p) => sum + Number(p.amount),
            0
          ),
        });
      }

      await queryRunner.manager.delete(ManagerPayment, {
        studentId: studentId,
      });
    }

    if ([null, undefined, ""].includes(dataForSend.managerId)) {
      dataForSend.managerId = null;
    }
    if ([null, undefined, ""].includes(dataForSend.procenatManagera)) {
      dataForSend.procenatManagera = null;
    }

    if([null,""].includes(dataForSend.createdAt)){
      delete dataForSend.createdAt;
    }

    // Prazno ime roditelja se čuva kao NULL (polje je opciono)
    if (dataForSend.imeRoditelja === "") {
      dataForSend.imeRoditelja = null;
    }

    // Izmenjena napomena se ponovo smatra neobrađenom, da nova poruka
    // menadžera ne bi ostala neprimećena pod ranije skinutom oznakom
    if (
      dataForSend.note !== undefined &&
      (dataForSend.note || null) !== (currentStudent.note || null)
    ) {
      dataForSend.noteHandledAt = null;
    }

    // Nalog vezan za vrstu upisa ne može da promeni tip učenika
    const tipUpisaNalogaZaIzmenu = tipUpisaZaNalog((req as any).user);
    if (tipUpisaNalogaZaIzmenu) {
      dataForSend.type = tipUpisaNalogaZaIzmenu;
    }
    if (dataForSend.type === "redovni") {
      dataForSend.entry_type = null;
      dataForSend.literature = null;
    }

    await queryRunner.manager.update(Student, studentId, dataForSend);

    const updatedStudent = await queryRunner.manager.findOne(Student, {
      where: { id: studentId },
      relations: ["menadzer", "payments", "occupation.school", "managerPayouts"],
    });

    await queryRunner.commitTransaction();

    if (updatedStudent) {
      // Literatura se naplaćuje odvojeno i ne ulazi u cenu školovanja
      const preostaliDug = obracunUcenika(updatedStudent).preostaliDug;

      const result = {
        id: updatedStudent?.id,
        ime: updatedStudent?.ime,
        prezime: updatedStudent.prezime,
        imeRoditelja: updatedStudent.imeRoditelja,
        datumKreiranja: updatedStudent?.createdAt,
        type: updatedStudent?.type,
        entry_type: updatedStudent?.entry_type,
        note: updatedStudent?.note,
        literature: updatedStudent.literature ? true : false,
        literatureCost: updatedStudent.literature || 0,
        literaturePaidAt: updatedStudent.literaturePaidAt,
        literaturePaid: !!updatedStudent.literaturePaidAt,
        zanimanje: updatedStudent.occupation
          ? {
              name: updatedStudent.occupation.name,
              id: updatedStudent.occupation.id,
            }
          : null,
        cenaSkolarine: updatedStudent.cenaSkolarine,
        preostaliDug: preostaliDug,
        procenatMenadzeru: updatedStudent.procenatManagera,
        menadzer: updatedStudent.menadzer,
        schoolId: updatedStudent.occupation?.school?.id,
      };

      res.status(200).json(result);
    } else {
      res.status(200).json([]);
    }
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.log(err);
    res.status(500).json({ error: "Greška pri ažuriranju studenta" });
  } finally {
    await queryRunner.release();
  }
});

// Administrator označava napomenu kao obrađenu (ili je vraća u neobrađene)
router.patch("/:id/napomena", async (req, res) => {
  try {
    if ((req as any).user?.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Samo administrator može da obradi napomenu" });
    }

    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) {
      return res.status(400).json({ message: "Nevalidan ID učenika" });
    }

    const student = await studentiRepo.findOne({ where: { id: studentId } });
    if (!student) {
      return res.status(404).json({ message: "Učenik nije pronađen" });
    }

    if (!student.note) {
      return res.status(400).json({ message: "Učenik nema napomenu" });
    }

    const obradjeno = req.body?.obradjeno === true;
    student.noteHandledAt = obradjeno ? new Date() : null;
    await studentiRepo.save(student);

    res.json({
      message: obradjeno
        ? "Napomena je označena kao obrađena"
        : "Napomena je vraćena među neobrađene",
      noteHandled: !!student.noteHandledAt,
      noteHandledAt: student.noteHandledAt,
    });
  } catch (error) {
    console.error("Greška pri obradi napomene:", error);
    res
      .status(500)
      .json({ message: "Došlo je do greške pri obradi napomene" });
  }
});

// Evidencija naplate literature — vodi se odvojeno od školarine
router.patch("/:id/literatura", async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) {
      return res.status(400).json({ message: "Nevalidan ID učenika" });
    }

    const student = await studentiRepo.findOne({ where: { id: studentId } });
    if (!student) {
      return res.status(404).json({ message: "Učenik nije pronađen" });
    }

    if (!student.literature) {
      return res
        .status(400)
        .json({ message: "Učenik nije uzeo literaturu" });
    }

    const placeno = req.body?.placeno === true;

    let datumPlacanja: Date | null = null;
    if (placeno) {
      datumPlacanja = req.body?.datum ? new Date(req.body.datum) : new Date();
      if (isNaN(datumPlacanja.getTime())) {
        return res.status(400).json({ message: "Neispravan format datuma." });
      }
    }

    student.literaturePaidAt = datumPlacanja;
    await studentiRepo.save(student);

    res.json({
      message: placeno
        ? "Literatura je evidentirana kao plaćena"
        : "Literatura je evidentirana kao neplaćena",
      literatureCost: student.literature,
      literaturePaid: !!student.literaturePaidAt,
      literaturePaidAt: student.literaturePaidAt,
    });
  } catch (error) {
    console.error("Greška pri evidenciji naplate literature:", error);
    res
      .status(500)
      .json({ message: "Došlo je do greške pri evidenciji naplate literature" });
  }
});

router.delete("/:id", async (req, res) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        message: "Nevalidan ID studenta",
      });
    }

    const studentId = parseInt(id);

    const student = await queryRunner.manager.findOne(Student, {
      where: { id: studentId } as FindOptionsWhere<Student>,
    });

    if (!student) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        message: "Student nije pronađen",
      });
    }

    const deletePaymentsResult = await queryRunner.manager.delete(Payment, {
      student: { id: studentId },
    });

    console.log(`Obrisano ${deletePaymentsResult.affected} uplata studenta`);

    await queryRunner.manager.remove(Student, student);

    console.log(student);

    await queryRunner.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Student i sve njegove uplate su uspešno obrisani",
      data: {
        id: studentId,
        name: student.ime,
        deletedPaymentsCount: deletePaymentsResult.affected,
      },
    });
  } catch (error: any) {
    await queryRunner.rollbackTransaction();

    console.error("Greška pri brisanju studenta:", error);

    res.status(500).json({
      success: false,
      message: "Došlo je do greške pri brisanju studenta",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    await queryRunner.release();
  }
});

export default router;
