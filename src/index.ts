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

import authRoutes from "./routes/authRoutes";
import { auth } from './middlewares/authMiddleware';
import cookieParser from 'cookie-parser';
import occupationsRoutes from "./routes/occupationsRoutes";
const app = express();
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

const PORT = process.env.PORT || 5000;

async function main() {
    try {
        await AppDataSource.initialize();
        console.log('✅ DataSource initialized');

        app.use('/api/auth', authRoutes);


        app.use('/api/menadzeri', auth(),menadzerRoutes);
        app.use('/api/statistics', auth(),statisticsRoutes);
        app.use('/api/students', auth() ,studentRoutes);
        app.use('/api/payments',auth() ,paymantsRoutes);
        app.use('/api/occupations',auth() ,occupationsRoutes);

        app.listen(PORT, () =>
            console.log(`🚀 Server pokrenut na http://localhost:${PORT}`)
        );
    } catch (err) {
        console.error('❌ Greška prilikom pokretanja aplikacije:', err);
        process.exit(1);
    }
}

main();
