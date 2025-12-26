import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
export interface AuthenticatedRequest extends Request {
    user?: {
        userId: number;
        schoolId: number | null;
        role: string;
    };
}

export const auth = () => {

    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {

        const token = req.header('Authorization')?.split(' ')[1] || req.cookies.authToken;

        if (!token) {
            return res.status(401).json({ message: 'Niste autorizovani' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
            req.user = decoded;
            next();
        } catch (err) {
            return res.status(401).json({ message: 'Nevažeći token' });
        }
    };
};

export const schoolAccessMiddleware = ()=>{
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const { user } = req;

        if (user?.role === 'admin' || user?.role === 'racunovodja') {
            return next();
        }

        if (!user?.schoolId) {
            return res.status(403).json({ message: 'Nemate pristpu!' });
        }

        next();
    };
}