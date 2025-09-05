// src/routes/userRoutes.ts
import { Router, Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import { User } from '../entity/User'
import { School } from '../entity/School'
import { FindOptionsWhere } from "typeorm"
import bcrypt from 'bcryptjs'

const router = Router()
const userRepo = AppDataSource.getRepository(User)
const schoolRepo = AppDataSource.getRepository(School)

// GET /users - Dobijanje svih korisnika
router.get('/', async (req: Request, res: Response) => {
    try {
        const role = req.query.role as string
        const schoolId = req.query.schoolId as string

        let whereConditions: FindOptionsWhere<User> = {}

        if (role) {
            whereConditions.role = role as 'admin' | 'school_manager' | 'korisnik'
        }

        if (schoolId) {
            whereConditions.schoolId = parseInt(schoolId)
        }

        const users = await userRepo.find({
            where: whereConditions,
            relations: ['school'],
            select: {
                id: true,
                email: true,
                role: true,
                schoolId: true,
                createdAt: true,
                updatedAt: true,
                // Ne vraćamo password iz bezbednosnih razloga
                password: false
            }
        })

        const result = users.map(user => ({
            id: user.id,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
            schoolName: user.school ? user.school.name : null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }))

        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Greška pri dobijanju korisnika' })
    }
})

// GET /users/:id - Dobijanje pojedinačnog korisnika
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id)

        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Nevalidan ID korisnika' })
        }

        const user = await userRepo.findOne({
            where: { id: userId },
            relations: ['school'],
            select: {
                id: true,
                email: true,
                role: true,
                schoolId: true,
                createdAt: true,
                updatedAt: true,
                password: false
            }
        })

        if (!user) {
            return res.status(404).json({ error: 'Korisnik nije pronađen' })
        }

        const result = {
            id: user.id,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
            schoolName: user.school ? user.school.name : null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }

        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Greška pri dobijanju korisnika' })
    }
})

// POST /users - Kreiranje novog korisnika
router.post('/', async (req: Request, res: Response) => {
    try {
        if (Array.isArray(req.body)) {
            return res.status(400).json({ error: 'Očekivan je objekat korisnika, a ne niz' })
        }

        const { email, passwordMy, role, schoolId } = req.body

        // Validacija obaveznih polja
        if (!email || !role) {
            return res.status(400).json({
                error: 'Email, password i role su obavezni'
            })
        }

        // Validacija role
        const validRoles = ['admin', 'school_manager', 'korisnik']
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                error: 'Role mora biti: admin, school_manager ili korisnik'
            })
        }

        // Validacija da li škola postoji (ako je schoolId prosleđen)
        if (schoolId) {
            const school = await schoolRepo.findOne({ where: { id: schoolId } })
            if (!school) {
                return res.status(400).json({ error: 'Škola sa datim ID-om ne postoji' })
            }
        }

        // Enkriptovanje password-a
        const saltRounds = 10
        const hashedPassword = await bcrypt.hash(passwordMy, saltRounds)

        const noviKorisnik = userRepo.create({
            email,
            password: hashedPassword,
            role,
            schoolId: schoolId || null
        })

        const sacuvanKorisnik = await userRepo.save(noviKorisnik)

        // Dobijanje korisnika sa relacijama
        const korisnikSaRelacijama = await userRepo.findOne({
            where: { id: sacuvanKorisnik.id },
            relations: ['school'],
            select: {
                id: true,
                email: true,
                role: true,
                schoolId: true,
                createdAt: true,
                updatedAt: true,
                password: false
            }
        })

        if (!korisnikSaRelacijama) {
            return res.status(404).json({ error: 'Korisnik nije pronađen nakon kreiranja' })
        }

        const result = {
            id: korisnikSaRelacijama.id,
            email: korisnikSaRelacijama.email,
            role: korisnikSaRelacijama.role,
            schoolId: korisnikSaRelacijama.schoolId,
            schoolName: korisnikSaRelacijama.school ? korisnikSaRelacijama.school.name : null,
            createdAt: korisnikSaRelacijama.createdAt,
            updatedAt: korisnikSaRelacijama.updatedAt
        }

        res.status(201).json(result)
    } catch (err: any) {
        console.error(err)

        // Specifična greška za duplicate email
        if (err.code === '23505' || err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email već postoji' })
        }

        res.status(400).json({ error: 'Neispravni podaci za korisnika' })
    }
})

// PATCH /users/:id - Ažuriranje korisnika
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id)

        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Nevalidan ID korisnika' })
        }

        const { email, passwordMy, role, schoolId } = req.body
        const updateData: any = {}

        // Dodavanje polja koja treba ažurirati
        if (email !== undefined) updateData.email = email
        if (role !== undefined) {
            const validRoles = ['admin', 'school_manager', 'korisnik']
            if (!validRoles.includes(role)) {
                return res.status(400).json({
                    error: 'Role mora biti: admin, school_manager ili korisnik'
                })
            }
            updateData.role = role
        }
        if (schoolId !== undefined) {
            if (schoolId && schoolId !== null) {
                const school = await schoolRepo.findOne({ where: { id: schoolId } })
                if (!school) {
                    return res.status(400).json({ error: 'Škola sa datim ID-om ne postoji' })
                }
            }
            updateData.schoolId = schoolId
        }

        // Enkriptovanje novog password-a ako je prosleđen
        if (passwordMy) {
            const saltRounds = 10
            updateData.password = await bcrypt.hash(passwordMy, saltRounds)
        }

        const updateResult = await userRepo.update(userId, updateData)

        if (updateResult.affected === 0) {
            return res.status(404).json({ error: 'Korisnik nije pronađen' })
        }

        const updatedUser = await userRepo.findOne({
            where: { id: userId },
            relations: ['school'],
            select: {
                id: true,
                email: true,
                role: true,
                schoolId: true,
                createdAt: true,
                updatedAt: true,
                password: false
            }
        })

        if (!updatedUser) {
            return res.status(404).json({ message: 'Korisnik nije pronađen' })
        }

        const result = {
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            schoolId: updatedUser.schoolId,
            schoolName: updatedUser.school ? updatedUser.school.name : null,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt
        }

        res.status(200).json(result)
    } catch (err: any) {
        console.error(err)

        // Specifična greška za duplicate email
        if (err.code === '23505' || err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email već postoji' })
        }

        res.status(400).json({ error: 'Neispravni podaci za korisnika' })
    }
})

// DELETE /users/:id - Brisanje korisnika
router.delete('/:id', async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
        const { id } = req.params

        // Validacija ID-a
        if (!id || isNaN(parseInt(id))) {
            await queryRunner.rollbackTransaction()
            return res.status(400).json({
                success: false,
                message: 'Nevalidan ID korisnika'
            })
        }

        const userId = parseInt(id)

        // Provera postojanja korisnika
        const user = await queryRunner.manager.findOne(User, {
            where: { id: userId } as FindOptionsWhere<User>,
            relations: ['school']
        })

        if (!user) {
            await queryRunner.rollbackTransaction()
            return res.status(404).json({
                success: false,
                message: 'Korisnik nije pronađen'
            })
        }

        // Provera da li je korisnik admin (opciono - možda ne želite da brišete admin-e)
        if (user.role === 'admin') {
            await queryRunner.rollbackTransaction()
            return res.status(403).json({
                success: false,
                message: 'Admin korisnici ne mogu biti obrisani'
            })
        }

        // Brisanje korisnika (ovde možete dodati brisanje povezanih entiteta ako je potrebno)
        await queryRunner.manager.remove(User, user)

        // Potvrda transakcije
        await queryRunner.commitTransaction()

        // Uspešan odgovor
        res.status(200).json({
            success: true,
            message: 'Korisnik je uspešno obrisan',
            data: {
                id: userId,
                email: user.email,
                role: user.role
            }
        })

    } catch (error: any) {
        // Rollback u slučaju greške
        await queryRunner.rollbackTransaction()

        console.error('Greška pri brisanju korisnika:', error)

        res.status(500).json({
            success: false,
            message: 'Došlo je do greške pri brisanju korisnika',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    } finally {
        await queryRunner.release()
    }
})

export default router