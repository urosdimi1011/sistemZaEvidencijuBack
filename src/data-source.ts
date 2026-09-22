import { DataSource } from 'typeorm';
import { Menadzer } from './entity/Menadzer';
import 'dotenv/config';
import {Student} from "./entity/Student";
// const isProd = process.env.NODE_ENV === "production";
import path from "path";
import {Payment} from "./entity/Payment";
import {ManagerPayment} from "./entity/ManagerPayment";
import {User} from "./entity/User";
import {School} from "./entity/School";
import {Occupation} from "./entity/Occupation";
export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    username:process.env.DB_USERNAME,
    password : process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),
    entities: [Menadzer,Student,Payment,ManagerPayment,User,School,Occupation],
    // Oba obrasca su navedena namerno: kad se pokreće preko ts-node, __dirname
    // je "src" i tamo postoje samo .ts fajlovi; kad se pokreće prevedeni kod,
    // __dirname je "dist" i tamo su samo .js. Tako избор не зависи од NODE_ENV.
    migrations: [
        path.join(__dirname, "migrations/*.js"),
        path.join(__dirname, "migrations/*.ts"),
    ],
    synchronize: false,
    // SSL je odvojen od NODE_ENV da bi migracije mogle da se puštaju sa
    // локалне машине ка удаљеној бази: DB_SSL=true уз обичан ts-node.
    ssl:
        process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
    migrationsRun:false,
    logging : false
});