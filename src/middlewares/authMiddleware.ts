import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const auth = () => {
    console.log('🔵 Middleware funkcija pozvana'); // Dodajte proveru

    return (req: Request, res: Response, next: NextFunction) => {
        console.log('🟢 Middleware izvršava se'); // Provera ulaska

        const token = req.header('Authorization')?.split(' ')[1] || req.cookies.authToken;
        console.log('Token:', token); // Provera tokena

        if (!token) {
            console.log('🔴 Nema tokena');
            return res.status(401).json({ message: 'Niste autorizovani' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!);
            // req.user = decoded;
            next(); // OBVEZNO pozvati next()!
        } catch (err) {
            console.log('🔴 Nevažeći token');
            return res.status(401).json({ message: 'Nevažeći token' });
        }
    };
};


// export const authenticate = (req : Request, res : Response, next : NextFunction) => {
//     // Proveri Authorization header PRVO
//     const authHeader = req.headers.authorization;
//     const tokenFromHeader = authHeader?.split(' ')[1]; // "Bearer <token>"
//
//     // Ako nema header-a, proveri cookie
//     const token = tokenFromHeader || req.cookies.authToken;
//
//     if (!token) return res.status(401).send('Niste ulogovani');
//
//     try {
//         const decoded = jwt.verify(token, process.env.JWT_SECRET!);
//         req.user = decoded;
//         next();
//     } catch (err) {
//         res.status(403).send('Nevalidan token');
//     }
// };