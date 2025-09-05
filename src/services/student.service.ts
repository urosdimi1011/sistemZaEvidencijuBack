import { AppDataSource } from '../data-source';
import {Student} from "../entity/Student";
import {Occupation} from "../entity/Occupation";

export class StudentService {
    private studentRepository = AppDataSource.getRepository(Student);
    private occupationRepository = AppDataSource.getRepository(Occupation);

    public async getOccupationsForSchool(schoolId: number) {
        return await this.occupationRepository.find({
            where: { school: { id: schoolId } }
        });
    }

    async getStudentsForSchool(schoolId: number, page: number = 1, limit: number = 20) {
        const [students, total] = await this.studentRepository
            .createQueryBuilder('student')
            .leftJoinAndSelect('student.occupation', 'occupation')
            .leftJoinAndSelect('occupation.school', 'school')
            .leftJoinAndSelect('student.menadzer', 'menadzer')
            .where('school.id = :schoolId', { schoolId })
            .skip((page - 1) * limit)
            .take(limit)
            .orderBy('student.createdAt', 'DESC')
            .getManyAndCount();

        return {
            students,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }
}