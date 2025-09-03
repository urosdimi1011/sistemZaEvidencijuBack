import { Router, Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import {Payment} from "../entity/Payment";
import {Student} from "../entity/Student";
import {ManagerPayment} from "../entity/ManagerPayment";

const router = Router()
const paymantRepo = AppDataSource.getRepository(Payment)
const studentRepo = AppDataSource.getRepository(Student)
const managerPaymentRepo = AppDataSource.getRepository(ManagerPayment);

router.post('/:id', async (_req, res) => {
    try {
        const studentId = parseInt(_req.params.id);
        const iznosZaUplatu = parseInt(_req.body.iznosZaUplatu);

        if (isNaN(studentId) || isNaN(iznosZaUplatu) || iznosZaUplatu <= 0) {
            return res.status(400).json({
                message: 'Nevalidan unos. ID studenta mora biti broj, a iznos pozitivan broj.'
            });
        }

        const student = await studentRepo.findOne({
            where: {id: studentId},
            relations: ["payments"]
        });

        if (!student) {
            return res.status(404).json({message: 'Student nije pronađen'});
        }

        const totalPaid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const remainingAmount = student.cenaSkolarine - totalPaid;
        console.log(remainingAmount);
        if (iznosZaUplatu > remainingAmount) {
            return res.status(400).json({
                message: `Iznos uplate (${iznosZaUplatu}€) premašuje preostali dug (${remainingAmount}€)`,
                maxAllowed: remainingAmount
            });
        }

        const payment = new Payment();
        payment.amount = iznosZaUplatu;
        payment.student = student;
        payment.paidAt = new Date();


        await paymantRepo.save(payment);


        res.status(201).json({
            message: 'Uplata uspešno evidentirana',
            payment: {
                id: payment.id,
                amount: payment.amount,
                paidAt: payment.paidAt
            },
            student: {
                totalPaid: totalPaid + iznosZaUplatu,
                remainingAmount: remainingAmount - iznosZaUplatu
            }
        });
    }
    catch (error) {
        console.error('Greška pri evidenciji uplate:', error);
        res.status(500).json({
            message: 'Došlo je do greške pri procesiranju uplate',
            error: error
        });
    }


});
router.post('/:idStudenta/isplataMenadzeru', async (req, res) => {
    try {
        const studentId = parseInt(req.params.idStudenta);
        let {iznosZaUplatu,desc} = req.body;

        iznosZaUplatu = parseInt(iznosZaUplatu);

        desc = desc || '';

        if (isNaN(studentId) || isNaN(iznosZaUplatu) || iznosZaUplatu <= 0) {
            return res.status(400).json({
                message: 'Nevalidan unos. ID studenta mora biti broj, a iznos pozitivan broj.'
            });
        }


        const student = await studentRepo.findOne({
            where: {'id':studentId},
            relations: ['menadzer','managerPayouts']
        });

        if (!student) {
            return res.status(404).json({message: 'Student nije pronađen'});
        }

        if(!student.menadzer){
            return res.status(404).json({message: 'Student nema menadzera'});
        }
        const totalPaidToManager = student.managerPayouts.reduce((sum, payout) => sum + Number(payout.amount), 0);

        const maxAllowedForManager = student.procenatManagera ? student.cenaSkolarine * (student.procenatManagera / 100) : null;
        let remainingForManager = null
        if(maxAllowedForManager){
            remainingForManager = maxAllowedForManager - totalPaidToManager;

        }
        if(remainingForManager){
            if (iznosZaUplatu > remainingForManager) {
                return res.status(400).json({
                    message: `Iznos premašuje preostali iznos za isplatu menadžeru. 
                 Možete isplatiti najviše ${remainingForManager.toFixed(2)}.`,
                    maxAllowed: remainingForManager,
                    totalPaidToManager: totalPaidToManager,
                    maxAllowedForManager: maxAllowedForManager
                });
            }
        }

        const novaIsplata = new ManagerPayment();
        novaIsplata.amount = iznosZaUplatu;
        novaIsplata.menadzer = student.menadzer;
        novaIsplata.paidAt = new Date();
        novaIsplata.student = student;
        novaIsplata.description = desc;

        // Čuvanje isplate
        await managerPaymentRepo.save(novaIsplata);

        res.status(201).json({
            message: 'Isplata menadžeru uspešno evidentirana',
            isplata: novaIsplata
        });


    } catch (error) {
        console.error('Greška pri dobavljanju studenata:', error);
        res.status(500).json({ message: 'Došlo je do greške pri uplati menadzeru' });
    }
});

export default router