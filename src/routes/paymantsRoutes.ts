import { Router, Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import {Payment} from "../entity/Payment";
import {Student} from "../entity/Student";
import {ManagerPayment} from "../entity/ManagerPayment";

const router = Router()
const paymantRepo = AppDataSource.getRepository(Payment)
const studentRepo = AppDataSource.getRepository(Student)
const managerPaymentRepo = AppDataSource.getRepository(ManagerPayment);

// Helper funkcija za kalkulaciju
async function calculateStudentBalance(student: Student) {
    // Ukupne direktne uplate učenika
    const totalPaidByStudent = student.payments.reduce((sum, payment) => 
        sum + Number(payment.amount), 0
    );
    
    // Ukupne isplate menadžeru
    const totalPaidToManager = student.managerPayouts.reduce((sum, payout) => 
        sum + Number(payout.amount), 0
    );
    
    // Ukupan dug
    const totalDebt = Number(student.cenaSkolarine) + (student.literature || 0);
    
    // Maksimalna isplata menadžeru
    const maxManagerPayout = student.procenatManagera 
        ? Number(student.cenaSkolarine) * (student.procenatManagera / 100) 
        : 0;
    
    // Preostalo za isplatu menadžeru
    const remainingForManager = Math.max(0, maxManagerPayout - totalPaidToManager);
    
    // KLJUČNA IZMENA: totalPaid = nominalne uplate učenika (bez oduzimanja menadžera)
    // Ali remainingAmount uzima u obzir isplate menadžeru
    const totalPaid = totalPaidByStudent;
    const remainingAmount = totalDebt - (totalPaidByStudent - totalPaidToManager);

    return {
        totalDebt: parseFloat(totalDebt.toFixed(2)),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        totalPaidToManager: parseFloat(totalPaidToManager.toFixed(2)),
        remainingAmount: parseFloat(remainingAmount.toFixed(2)),
        maxManagerPayout: parseFloat(maxManagerPayout.toFixed(2)),
        remainingForManager: parseFloat(remainingForManager.toFixed(2))
    };
}

// POST - Nova uplata učenika
router.post('/:id', async (_req, res) => {
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
            relations: ["payments", "managerPayouts"]
        });

        if (!student) {
            return res.status(404).json({message: 'Student nije pronađen'});
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
        const newRemainingAmount = balance.totalDebt - (newTotalPaid - balance.totalPaidToManager);

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
                remainingAmount: parseFloat(newRemainingAmount.toFixed(2))
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
router.patch('/:id', async (_req, res) => {
    const paymentId = parseInt(_req.params.id);
    const iznosUplate = parseFloat(_req.body.iznosZaUplatu);
    const note = _req.body.note || null;
    const datumUplateString = _req.body.datumUplate;

    try {
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
        const totalPaidWithoutCurrent = student.payments
            .filter(p => p.id !== paymentId)
            .reduce((sum, p) => sum + Number(p.amount), 0);
        
        const totalPaidToManager = student.managerPayouts.reduce((sum, payout) => 
            sum + Number(payout.amount), 0
        );
        
        const totalDebt = Number(student.cenaSkolarine) + (student.literature || 0);
        
        const newTotalPaid = totalPaidWithoutCurrent + iznosUplate;
        
        const effectiveCovered = newTotalPaid - totalPaidToManager;
        
        // Provera da efektivna uplata ne premašuje dug
        if (effectiveCovered > totalDebt) {
            const maxNominalAllowed = totalDebt + totalPaidToManager - totalPaidWithoutCurrent;
            return res.status(400).json({
                message: `Novi iznos (${iznosUplate}€) premašuje preostali dug. Maksimalan iznos: ${maxNominalAllowed.toFixed(2)}€`,
                maxAllowed: parseFloat(maxNominalAllowed.toFixed(2))
            });
        }

        payment.amount = iznosUplate;
        payment.paidAt = datumUplate;
        payment.note = note;
        await paymantRepo.save(payment);

        const remainingAmount = totalDebt - effectiveCovered;

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
router.delete('/:id', async (_req, res) => {
    const paymentId = parseInt(_req.params.id);
    
    try {
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
        const totalPaid = student.payments
            .filter(p => p.id !== paymentId)
            .reduce((sum, p) => sum + Number(p.amount), 0);
        
        const totalPaidToManager = student.managerPayouts.reduce((sum, payout) => 
            sum + Number(payout.amount), 0
        );
        
        const totalDebt = Number(student.cenaSkolarine) + (student.literature || 0);
        const remainingAmount = totalDebt - totalPaid - totalPaidToManager;

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
router.post('/:idStudenta/isplataMenadzeru', async (req, res) => {
    try {
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