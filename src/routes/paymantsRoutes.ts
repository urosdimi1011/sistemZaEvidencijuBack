import { Router, Request, Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/authMiddleware'
import { rateZaUcenika } from '../utiles/rateMenadzera'
import { zabranaPristupaUceniku, samoAdminIliRacunovodja } from '../utiles/pristupUplatama'
import { AppDataSource } from '../data-source'
import {Payment} from "../entity/Payment";
import {Student} from "../entity/Student";
import {ManagerPayment} from "../entity/ManagerPayment";
import {
    obracunUcenika,
    RELACIJE_ZA_OBRACUN,
    saberiIznose,
    stanjeUcenika,
    ukupanDug,
    zaokruziNovac,
} from "../utiles/obracun";

const router = Router()
const paymantRepo = AppDataSource.getRepository(Payment)
const studentRepo = AppDataSource.getRepository(Student)
const managerPaymentRepo = AppDataSource.getRepository(ManagerPayment);

// Uz obračun treba i škola, da bi se utvrdilo kojem nalogu učenik pripada
const RELACIJE_ZA_UPLATE = [...RELACIJE_ZA_OBRACUN, "occupation.school"];

// Helper funkcija za kalkulaciju.
// Literatura se naplaćuje odvojeno i ne ulazi u školarinu.
// Dug se ne prikazuje u minusu nego kao izmireno, a višak kao preplata.
// Isplata menadžeru ne utiče na dug učenika — vodi se odvojeno.
async function calculateStudentBalance(student: Student) {
    const obracun = obracunUcenika(student, true);

    return {
        totalDebt: zaokruziNovac(obracun.ukupanDug),
        totalPaid: zaokruziNovac(obracun.uplaceno),
        totalPaidToManager: zaokruziNovac(obracun.isplacenoMenadzeru),
        remainingAmount: zaokruziNovac(obracun.preostaliDug),
        preplata: zaokruziNovac(obracun.preplata),
        maxManagerPayout: zaokruziNovac(obracun.provizijaMenadzera),
        remainingForManager: zaokruziNovac(obracun.preostaloMenadzeru)
    };
}

// POST - Nova uplata učenika
router.post('/:id', async (_req: AuthenticatedRequest, res) => {
    try {
        const studentId = parseInt(_req.params.id);
        const iznosZaUplatu = parseFloat(_req.body.iznosZaUplatu);
        const datumUplateString = _req.body.datumUplate;
        const note = _req.body.note || null;

        // Validacija
        if (isNaN(studentId) || isNaN(iznosZaUplatu) || iznosZaUplatu <= 0) {
            return res.status(400).json({
                message: 'Nevalidan unos. ID studenta mora biti broj, a iznos pozitivan broj.'
            });
        }

        if (!datumUplateString) {
            return res.status(400).json({
                message: 'Datum uplate je obavezan.'
            });
        }
        
        const datumUplate = new Date(datumUplateString);
        if (isNaN(datumUplate.getTime())) {
            return res.status(400).json({
                message: 'Neispravan format datuma.'
            });
        }

        // Učitaj studenta
        const student = await studentRepo.findOne({
            where: {id: studentId},
            relations: RELACIJE_ZA_UPLATE
        });

        if (!student) {
            return res.status(404).json({message: 'Student nije pronađen'});
        }

        // Nalog škole sme da unese uplatu samo svom učeniku
        const zabrana = zabranaPristupaUceniku(_req.user, student);
        if (zabrana) {
            return res.status(403).json({message: zabrana});
        }

        // Kalkulacija pre nove uplate
        const balance = await calculateStudentBalance(student);

        // Uplata sme da pređe preostali dug — učenik ponekad zaokruži
        // iznos naviše. Višak se vodi kao preplata, a NE povećava ono
        // što sleduje menadžeru: njegova provizija je ograničena na
        // procenat od cene školarine (vidi rateZaUcenika).
        //
        // Da unos od 15000 umesto 1500 ne bi prošao nezapaženo, ekran
        // pre slanja traži potvrdu kad iznos pređe dug.

        // Kreiraj novu uplatu
        const payment = new Payment();
        payment.amount = iznosZaUplatu;
        payment.student = student;
        payment.paidAt = datumUplate;
        payment.note = note;

        await paymantRepo.save(payment);

        // Kalkulacija nakon nove uplate
        const newTotalPaid = balance.totalPaid + iznosZaUplatu;
        const {
            preostaliDug: newRemainingAmount,
            preplata: novaPreplata,
        } = stanjeUcenika(balance.totalDebt, newTotalPaid);

        res.status(201).json({
            message: 'Uplata uspešno evidentirana',
            payment: {
                id: payment.id,
                amount: payment.amount,
                paidAt: payment.paidAt,
                note: payment.note
            },
            student: {
                id: student.id,
                totalPaid: parseFloat(newTotalPaid.toFixed(2)),
                remainingAmount: parseFloat(newRemainingAmount.toFixed(2)),
                preplata: parseFloat(novaPreplata.toFixed(2))
            }
        });
    }
    catch (error) {
        console.error('Greška pri evidenciji uplate:', error);
        res.status(500).json({
            message: 'Došlo je do greške pri procesiranju uplate',
        });
    }
});

// PATCH - Izmena uplate
router.patch('/:id', async (_req: AuthenticatedRequest, res) => {
    const paymentId = parseInt(_req.params.id);
    const iznosUplate = parseFloat(_req.body.iznosZaUplatu);
    const note = _req.body.note || null;
    const datumUplateString = _req.body.datumUplate;

    try {
        // Izmena već evidentirane uplate nije za naloge škola
        const zabrana = samoAdminIliRacunovodja(_req.user);
        if (zabrana) {
            return res.status(403).json({message: zabrana});
        }

        // Validacija
        if (isNaN(iznosUplate) || iznosUplate <= 0 || !datumUplateString) {
            return res.status(400).json({
                message: 'Morate poslati validne podatke (iznosUplate > 0 i datumUplate)'
            });
        }

        const datumUplate = new Date(datumUplateString);
        if (isNaN(datumUplate.getTime())) {
            return res.status(400).json({
                message: 'Neispravan format datuma.'
            });
        }

        // Pronađi uplatu
        const payment = await paymantRepo.findOne({
            where: { id: paymentId },
            relations: ['student', 'student.payments', 'student.managerPayouts']
        });

        if (!payment) {
            return res.status(404).json({
                message: 'Uplata nije pronađena'
            });
        }

        const student = payment.student;
        
        // Kalkulacija bez trenutne uplate
        const totalPaidWithoutCurrent = saberiIznose(
            student.payments?.filter(p => p.id !== paymentId),
            "uplate učenika"
        );

        // Literatura se naplaćuje odvojeno i ne ulazi u školarinu
        const totalDebt = ukupanDug(student.cenaSkolarine);

        const newTotalPaid = totalPaidWithoutCurrent + iznosUplate;

        // Zbir rata sme da pređe dug — višak se vodi kao preplata,
        // isto kao i kod unosa nove uplate.

        payment.amount = iznosUplate;
        payment.paidAt = datumUplate;
        payment.note = note;
        await paymantRepo.save(payment);

        const { preostaliDug: remainingAmount, preplata } = stanjeUcenika(
            totalDebt,
            newTotalPaid
        );

        res.status(200).json({
            message: 'Uplata uspešno ažurirana',
            payment: {
                id: payment.id,
                iznosUplate: payment.amount,
                datumUplate: payment.paidAt,
                note: payment.note
            },
            student: {
                id: student.id,
                totalPaid: parseFloat(newTotalPaid.toFixed(2)),
                remainingAmount: parseFloat(remainingAmount.toFixed(2)),
                preplata: parseFloat(preplata.toFixed(2)),
                ukupanDug: parseFloat(totalDebt.toFixed(2))
            }
        });
    } catch (error) {
        console.error('Greška pri ažuriranju uplate:', error);
        res.status(500).json({ 
            error: 'Greška servera pri ažuriranju uplate' 
        });
    }
});

// DELETE - Brisanje uplate
router.delete('/:id', async (_req: AuthenticatedRequest, res) => {
    const paymentId = parseInt(_req.params.id);

    try {
        // Brisanje uplate nije za naloge škola
        const zabrana = samoAdminIliRacunovodja(_req.user);
        if (zabrana) {
            return res.status(403).json({message: zabrana});
        }

        const payment = await paymantRepo.findOne({
            where: { id: paymentId },
            relations: ['student', 'student.payments', 'student.managerPayouts']
        });

        if (!payment) {
            return res.status(404).json({
                message: 'Uplata nije pronađena'
            });
        }

        const student = payment.student;
        const deletedAmount = Number(payment.amount);
        
        await paymantRepo.delete(paymentId);

        // Kalkulacija nakon brisanja
        const totalPaid = saberiIznose(
            student.payments?.filter(p => p.id !== paymentId),
            "uplate učenika"
        );

        // Literatura se naplaćuje odvojeno i ne ulazi u školarinu
        const totalDebt = ukupanDug(student.cenaSkolarine);
        const { preostaliDug: remainingAmount, preplata } = stanjeUcenika(
            totalDebt,
            totalPaid
        );

        res.status(200).json({
            message: 'Uplata uspešno obrisana',
            deletedPayment: {
                id: paymentId,
                amount: deletedAmount
            },
            student: {
                id: student.id,
                totalPaid: parseFloat(totalPaid.toFixed(2)),
                remainingAmount: parseFloat(remainingAmount.toFixed(2)),
                preplata: parseFloat(preplata.toFixed(2)),
                totalDebt: parseFloat(totalDebt.toFixed(2))
            }
        });

    } catch (error) {
        console.error('Greška pri brisanju uplate:', error);
        res.status(500).json({ 
            error: 'Greška servera pri brisanju uplate' 
        });
    }
});

/**
 * Učitava učenika sa svime što treba za rate menadžera.
 * Vraća poruku o grešci umesto učenika kad nešto ne valja.
 */
type NalazUcenika =
    | { greska: string; status: number }
    | { student: Student };

async function ucenikZaRate(
    studentId: number,
    user: AuthenticatedRequest['user']
): Promise<NalazUcenika> {
    const zabrana = samoAdminIliRacunovodja(user);
    if (zabrana) return { greska: zabrana, status: 403 };

    if (!Number.isInteger(studentId) || studentId <= 0) {
        return { greska: 'Nevalidan učenik', status: 400 };
    }

    const student = await studentRepo.findOne({
        where: { id: studentId },
        relations: [...RELACIJE_ZA_OBRACUN, 'menadzer'],
    });

    if (!student) return { greska: 'Student nije pronađen', status: 404 };
    if (!student.menadzer) {
        return { greska: 'Student nema menadžera', status: 400 as const };
    }
    if (!student.procenatManagera || student.procenatManagera <= 0) {
        return {
            greska: 'Procenat menadžera nije određen za ovog učenika',
            status: 400,
        };
    }

    return { student };
}

/**
 * POST - označava da je menadžeru isplaćena rata za jednu uplatu učenika.
 *
 * Iznos se ne prima iz zahteva nego se računa iz same uplate i procenta,
 * da administracija ne bi morala ništa da kuca i da se ne bi omašilo.
 */
router.post('/:idStudenta/rata/:paymentId', async (req: AuthenticatedRequest, res) => {
    try {
        const studentId = parseInt(req.params.idStudenta);
        const paymentId = parseInt(req.params.paymentId);

        const nalaz = await ucenikZaRate(studentId, req.user);
        if ('greska' in nalaz) {
            return res.status(nalaz.status).json({ message: nalaz.greska });
        }
        const student = nalaz.student;

        // Uplata mora da pripada baš tom učeniku
        const uplata = (student.payments ?? []).find(p => p.id === paymentId);
        if (!uplata) {
            return res
                .status(404)
                .json({ message: 'Uplata nije pronađena kod ovog učenika' });
        }

        // Dvostruki klik ne sme da isplati menadžeru dvaput
        const vecIsplacena = await managerPaymentRepo.findOne({
            where: { paymentId },
        });
        if (vecIsplacena) {
            return res
                .status(409)
                .json({ message: 'Та рата је већ означена као исплаћена' });
        }

        // Iznos se uzima iz istog obračuna koji se prikazuje na ekranu —
        // tako je ograničen ukupnom provizijom, pa preplata učenika ne
        // može da naduva ono što menadžeru sleduje
        const obracun = obracunUcenika(student);
        const rate = rateZaUcenika(
            student.payments,
            student.managerPayouts,
            student.procenatManagera,
            obracun.provizijaMenadzera
        );
        const rata = rate.find(r => r.paymentId === paymentId);
        const iznos = rata ? rata.sledujeMenadzeru : 0;

        if (iznos <= 0) {
            return res.status(400).json({
                message:
                    'Из те уплате менаџеру ништа не следује — провизија је већ попуњена',
            });
        }

        const isplata = new ManagerPayment();
        isplata.amount = iznos;
        isplata.menadzer = student.menadzer!;
        isplata.student = student;
        isplata.paymentId = paymentId;
        isplata.paidAt = new Date();
        isplata.description = `Рата за уплату од ${new Date(
            uplata.paidAt
        ).toLocaleDateString('sr-RS')}`;

        await managerPaymentRepo.save(isplata);

        res.status(201).json({
            message: 'Рата је означена као исплаћена',
            isplata: {
                id: isplata.id,
                amount: iznos,
                paidAt: isplata.paidAt,
                paymentId,
            },
        });
    } catch (error) {
        console.error('Greška pri označavanju rate:', error);
        res.status(500).json({ message: 'Дошло је до грешке' });
    }
});

/**
 * DELETE - poništava oznaku da je rata isplaćena.
 * Briše zapis o isplati, pa ide iza potvrde na ekranu.
 */
router.delete('/:idStudenta/rata/:paymentId', async (req: AuthenticatedRequest, res) => {
    try {
        const studentId = parseInt(req.params.idStudenta);
        const paymentId = parseInt(req.params.paymentId);

        const nalaz = await ucenikZaRate(studentId, req.user);
        if ('greska' in nalaz) {
            return res.status(nalaz.status).json({ message: nalaz.greska });
        }

        const isplata = await managerPaymentRepo.findOne({
            where: { paymentId, studentId },
        });
        if (!isplata) {
            return res
                .status(404)
                .json({ message: 'Та рата није ни означена као исплаћена' });
        }

        await managerPaymentRepo.delete(isplata.id);

        res.json({
            message: 'Ознака је поништена',
            paymentId,
        });
    } catch (error) {
        console.error('Greška pri poništavanju rate:', error);
        res.status(500).json({ message: 'Дошло је до грешке' });
    }
});

// Ručni unos iznosa isplate menadžeru je uklonjen — iznos se sada
// računa sam, iz uplate učenika i procenta, a administracija samo
// štiklira koja je rata isplaćena (rute /:idStudenta/rata/:paymentId).


export default router