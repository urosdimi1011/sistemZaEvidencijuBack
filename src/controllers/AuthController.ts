import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../data-source';
import { User } from '../entity/User';

const userRepository = AppDataSource.getRepository(User);

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, role } = req.body;

        const existingUser = await userRepository.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'Email već postoji' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = userRepository.create({
            email,
            password: hashedPassword,
            role
        });

        await userRepository.save(user);
        res.status(201).json({ message: 'Korisnik uspešno registrovan' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Greška prilikom registracije' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const user = await userRepository.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Pogrešan email ili lozinka' });
        }

        const tokenAuth = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: '1h' }
        );

        const userResponse = {
            email : user.email,
            role : user.role
        }

        res.cookie('authToken', tokenAuth, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 15 * 60 * 1000,
        });

        res.json({ tokenAuth, user:userResponse});
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Greška prilikom prijave' });
    }
};



export const me =  async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader?.split(' ')[1];
    const token = tokenFromHeader || req.cookies.authToken;
    if (!token) return res.status(401).send('Niste ulogovani');

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        res.json({ tokenAuth : token,user: decoded });
    }
    catch (err) {
        res.status(403).send('Nevalidan token');
    }
};

export const logout = async (req: Request, res: Response) => {
    try{
        // const token = req.cookies.authToken || req.headers.authorization?.split(' ')[1];

        res.clearCookie('authToken', {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
        });

        res.status(200).json({
            success: true,
            message: 'Uspešno ste se odjavili'
        });

    }
    catch (error){
        console.error('Greška prilikom odjave:', error);
        res.status(500).json({
            success: false,
            message: 'Došlo je do greške prilikom odjave'
        });
    }
    // const authHeader = req.headers.authorization;
    // const tokenFromHeader = authHeader?.split(' ')[1];
    // const token = tokenFromHeader || req.cookies.authToken;
    // if (!token) return res.status(401).send('Niste ulogovani');
    //
    // try {
    //     const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    //     res.json({ tokenAuth : token,user: decoded });
    // }
    // catch (err) {
    //     res.status(403).send('Nevalidan token');
    // }
};
