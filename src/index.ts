import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { AppDataSource } from './data-source';

import menadzerRoutes from "./routes/menadzerRoutes";
import studentRoutes from "./routes/studentRoutes";
import paymantsRoutes from "./routes/paymantsRoutes";
import statisticsRoutes from './routes/statisticsRoutes';
import schoolRoutes from './routes/schoolsRoutes';

import authRoutes from "./routes/authRoutes";
import {auth, schoolAccessMiddleware} from './middlewares/authMiddleware';
import cookieParser from 'cookie-parser';
import occupationsRoutes from "./routes/occupationsRoutes";
import usersRoutes from "./routes/UsersRoutes";

const app = express();

app.use(cookieParser());

app.use(cors({
    origin: [
        'https://kaleidoscopic-croissant-94ae88.netlify.app',
        'http://localhost:4173',
        'http://localhost:5173'
    ],
    credentials: true
}));

app.use(express.json());
const PORT = process.env.PORT || 5000;

async function main() {
    try {
        await AppDataSource.initialize();
        console.log('✅ DataSource initialized');

        app.use('/api/auth', authRoutes);


        app.use('/api/menadzeri', [auth(),schoolAccessMiddleware()],menadzerRoutes);
        app.use('/api/statistics', [auth(),schoolAccessMiddleware()],statisticsRoutes);
        app.use('/api/students', [auth(),schoolAccessMiddleware()] ,studentRoutes);
        app.use('/api/payments',[auth(),schoolAccessMiddleware()] ,paymantsRoutes);
        app.use('/api/schools',[auth(),schoolAccessMiddleware()] ,schoolRoutes);
        app.use('/api/occupations',[auth(),schoolAccessMiddleware()] ,occupationsRoutes);
        app.use('/api/users',[auth(),schoolAccessMiddleware()] ,usersRoutes);

        app.listen(PORT, () =>
            console.log(`🚀 Server pokrenut na http://localhost:${PORT}`)
        );
    } catch (err) {
        console.error('❌ Greška prilikom pokretanja aplikacije:', err);
        process.exit(1);
    }
}

main();
