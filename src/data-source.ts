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
    migrations:
        process.env.NODE_ENV === "production"
            ? [path.join(__dirname, "migrations/*.js")]
            : [path.join(__dirname, "migrations/*.ts")],
    synchronize: false,
    migrationsRun:false,
    logging : false
});