// Funkcija za filtriranje studenata po intervalu
import {Student} from "../entity/Student";
import {
    getSchoolYearForDate,
    getSchoolYearLabel,
    getSchoolYearMonths,
    getSchoolYearRange,
} from "./schoolYear";

export function filterStudentsByRangeAndYear(students: any[], range: string, year: string): any[] {
    let filteredStudents = students;

    // Prvo filtriraj po ŠKOLSKOJ godini ako je postavljena (year = početna godina, npr. 2025 = 2025/26)
    if (year && year !== 'all') {
        const targetYear = parseInt(year);
        filteredStudents = filteredStudents.filter(s => {
            return getSchoolYearForDate(new Date(s.createdAt)) === targetYear;
        });
    }

    // Zatim filtriraj po range-u
    if (range) {
        filteredStudents = filterStudentsByRange(filteredStudents, range);
    }

    return filteredStudents;
}
export  function filterStudentsByRange(students: any[], range: string): any[] {
    const now = new Date();

    switch (range) {
        case 'year': {
            // Tekuća ŠKOLSKA godina (1. septembar - danas)
            const { start } = getSchoolYearRange(getSchoolYearForDate(now));
            return students.filter(s => new Date(s.createdAt).getTime() >= start.getTime());
        }

        case 'month': {
            // Tekući mesec (1. u mesecu - danas)
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return students.filter(s => new Date(s.createdAt).getTime() >= startOfMonth.getTime());
        }

        default:
            return students; // 'all' - svi studenti
    }
}


// Funkcija za mesečnu statistiku
export function getDetailedStats(students: any[], range: string, year: string): any {
    const stats: any = {};

    // Uvek prikazuj statistiku po školskim godinama
    stats.yearly = getYearlyStats(students);

    // Ako je izabrana specifična školska godina, prikaži mesečnu statistiku za tu godinu
    if (year && year !== 'all') {
        stats.monthly = getMonthlyStatsForYear(students, parseInt(year));
    }
    // Inače, za opseg 'month' ili 'all' prikazuj mesečnu statistiku za sve
    else if (range === 'month' || range === 'all') {
        stats.monthly = getMonthlyStats(students);
    }

    return stats;
}

// Mesečna statistika za jednu ŠKOLSKU godinu (septembar -> avgust)
export function getMonthlyStatsForYear(students: any[], schoolYearStart: number): { [monthKey: string]: number } {
    const monthlyStats: { [monthKey: string]: number } = {};

    // Inicijalizuj sve mesece školske godine sa 0 (redom od septembra)
    for (const { month, year } of getSchoolYearMonths(schoolYearStart)) {
        const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
        monthlyStats[monthKey] = 0;
    }

    // Popuni stvarnim podacima
    students.forEach(student => {
        const date = new Date(student.createdAt);
        if (getSchoolYearForDate(date) === schoolYearStart) {
            const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + 1;
        }
    });

    return monthlyStats;
}

// Statistika po ŠKOLSKIM godinama, npr. { "2025/2026": 15 }
export function getYearlyStats(students: any[]): { [year: string]: number } {
    const yearlyStats: { [year: string]: number } = {};

    students.forEach(student => {
        const label = getSchoolYearLabel(getSchoolYearForDate(new Date(student.createdAt)));
        yearlyStats[label] = (yearlyStats[label] || 0) + 1;
    });

    return yearlyStats;
}

// Funkcija za mesečnu statistiku
export function getMonthlyStats(students: any[]): { [monthKey: string]: number } {
    const monthlyStats: { [monthKey: string]: number } = {};

    students.forEach(student => {
        const date = new Date(student.createdAt);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + 1;
    });

    return monthlyStats;
}

// Dostupne ŠKOLSKE godine (vraća početne godine, npr. [2025, 2024])
export function getAvailableYears(students: any[]): number[] {
    const years = new Set<number>();

    students.forEach(student => {
        years.add(getSchoolYearForDate(new Date(student.createdAt)));
    });

    return Array.from(years).sort((a, b) => b - a); // Sortiraj opadajuće
}
