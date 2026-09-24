import { Router, Request, Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/authMiddleware'
import { zabranaPristupaUceniku, samoAdminIliRacunovodja } from '../utiles/pristupUplatama'
import { AppDataSource } from '../data-source'
import {Payment} from "../entity/Payment";
import {Student} from "../entity/Student";
import {ManagerPayment} from "../entity/ManagerPayment";
import {
    maksimalnaIzmenaUplate,
    obracunUcenika,
    saberiIznose,
    stanjeUcenika,
    ukupanDug,
    zaokruziNovac,
} from "../utiles/obracun";

const router = Router()
const paymantRepo = AppDataSource.getRepository(Payment)
const studentRepo = AppDataSource.getRepository(Student)
const managerPaymentRepo = AppDataSource.getRepository(ManagerPayment);

// Relacije potrebne da bi se utvrdilo kojoj školi učenik pripada
const RELACIJE_ZA_OBRACUN = ["payments", "managerPayouts", "occupation.school"];

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
            relations: RELACIJE_ZA_OBRACUN
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

        // Provera da uplata ne premašuje preostali dug
        if (iznosZaUplatu > balance.remainingAmount) {
            return res.status(400).json({
                message: `Iznos uplate (${iznosZaUplatu}€) premašuje preostali dug (${balance.remainingAmount}€)`,
                maxAllowed: balance.remainingAmount
            });
        }

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

        // Provera da zbir svih rata ne premašuje dug.
        // Isplate menadžeru se ovde ne mešaju — vode se odvojeno.
        if (newTotalPaid > totalDebt) {
            const maxNominalAllowed = maksimalnaIzmenaUplate(
                totalDebt,
                totalPaidWithoutCurrent
            );
            return res.status(400).json({
                message: `Novi iznos (${iznosUplate}€) premašuje preostali dug. Maksimalan iznos: ${maxNominalAllowed.toFixed(2)}€`,
                maxAllowed: parseFloat(maxNominalAllowed.toFixed(2))
            });
        }

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

// POST - Isplata menadžeru
router.post('/:idStudenta/isplataMenadzeru', async (req: AuthenticatedRequest, res) => {
    try {
        // Isplate menadžerima nisu u nadležnosti naloga škola
        const zabrana = samoAdminIliRacunovodja(req.user);
        if (zabrana) {
            return res.status(403).json({message: zabrana});
        }

        const studentId = parseInt(req.params.idStudenta);
        let {iznosZaUplatu, desc, datumIsplate} = req.body;

        iznosZaUplatu = parseFloat(iznosZaUplatu);
        desc = desc || '';

        // Validacija datuma
        datumIsplate = new Date(datumIsplate);
        if (isNaN(datumIsplate.getTime())) {
            return res.status(400).json({
                message: 'Neispravan format datuma.'
            });
        }

        // Validacija iznosa
        if (isNaN(studentId) || isNaN(iznosZaUplatu) || iznosZaUplatu <= 0) {
            return res.status(400).json({
                message: 'Nevalidan unos. ID studenta mora biti broj, a iznos pozitivan broj.'
            });
        }

        // Učitaj studenta
        const student = await studentRepo.findOne({
            where: {'id': studentId},
            relations: ['menadzer', 'managerPayouts', 'payments']
        });

        if (!student) {
            return res.status(404).json({message: 'Student nije pronađen'});
        }

        if (!student.menadzer) {
            return res.status(404).json({message: 'Student nema menadžera'});
        }

        // Provera da li postoji definisan procenat za menadžera
        if (!student.procenatManagera || student.procenatManagera <= 0) {
            return res.status(400).json({
                message: 'Procenat menadžera nije definisan za ovog studenta'
            });
        }

        const balance = await calculateStudentBalance(student);

        // Provera da isplata ne premašuje dozvoljeni iznos za menadžera
        if (iznosZaUplatu > balance.remainingForManager) {
            return res.status(400).json({
                message: `Iznos premašuje preostali iznos za isplatu menadžeru. Možete isplatiti najviše ${balance.remainingForManager}€`,
                maxAllowed: balance.remainingForManager,
                totalPaidToManager: balance.totalPaidToManager,
                maxAllowedForManager: balance.maxManagerPayout
            });
        }

        // KLJUČNA PROVERA: Da li student ima dovoljno uplata da pokrije isplatu menadžeru?
        const newTotalPaidToManager = balance.totalPaidToManager + iznosZaUplatu;
        if (newTotalPaidToManager > balance.totalPaid) {
            return res.status(400).json({
                message: `Ne možete isplatiti menadžeru više nego što je student uplatio. Student je uplatio ${balance.totalPaid}€, a pokušavate isplatiti menadžeru ukupno ${newTotalPaidToManager}€`
            });
        }

        // Kreiraj isplatu menadžeru
        const novaIsplata = new ManagerPayment();
        novaIsplata.amount = iznosZaUplatu;
        novaIsplata.menadzer = student.menadzer;
        novaIsplata.paidAt = datumIsplate;
        novaIsplata.student = student;
        novaIsplata.description = desc;

        await managerPaymentRepo.save(novaIsplata);

        res.status(201).json({
            message: 'Isplata menadžeru uspešno evidentirana',
            isplata: novaIsplata
        });

    } catch (error) {
        console.error('Greška pri isplati menadžeru:', error);
        res.status(500).json({ message: 'Došlo je do greške pri uplati menadžeru' });
    }
});

export default router