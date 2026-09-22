import { Router } from 'express';
import {login, me, logout} from '../controllers/AuthController';

const router = Router();

// Javna registracija je uklonjena — naloge pravi isključivo administrator
// kroz stranicu "Кориснички налози" (POST /api/users).
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', me);

export default router;