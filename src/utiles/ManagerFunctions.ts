// Funkcija za filtriranje studenata po intervalu
import {Student} from "../entity/Student";
export function filterStudentsByRangeAndYear(students: any[], range: string, year: string): any[] {
    let filteredStudents = students;

    // Prvo filtriraj po godini ako je postavljena
    if (year && year !== 'all') {
        const targetYear = parseInt(year);
        filteredStudents = filteredStudents.filter(s => {
            const studentYear = new Date(s.createdAt).getFullYear();
            return studentYear === targetYear;
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
        case 'year':
            // Tekuća godina (1. januar - danas)
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            return students.filter(s => new Date(s.createdAt).getTime() >= startOfYear.getTime());

        case 'month':
            // Tekući mesec (1. u mesecu - danas)
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return students.filter(s => new Date(s.createdAt).getTime() >= startOfMonth.getTime());


        default:
            return students; // 'all' - svi studenti
    }
}


// Funkcija za mesečnu statistiku
export function getDetailedStats(students: any[], range: string, year: string): any {
    const stats: any = {};

    // Uvek prikazuj godišnju statistiku
    stats.yearly = getYearlyStats(students);

    // Ako je izabrana specifična godina, prikaži mesečnu statistiku za tu godinu
    if (year && year !== 'all') {
        stats.monthly = getMonthlyStatsForYear(students, parseInt(year));
    }
    // Inače, za opseg 'month' ili 'all' prikazuj mesečnu statistiku za sve
    else if (range === 'month' || range === 'all') {
        stats.monthly = getMonthlyStats(students);
    }

    return stats;
}

export function getMonthlyStatsForYear(students: any[], year: number): { [monthKey: string]: number } {
    const monthlyStats: { [monthKey: string]: number } = {};

    // Inicijalizuj sve mesece u godini sa 0
    for (let month = 1; month <= 12; month++) {
        const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
        monthlyStats[monthKey] = 0;
    }

    // Popuni stvarnim podacima
    students.forEach(student => {
        const date = new Date(student.createdAt);
        if (date.getFullYear() === year) {
            const monthKey = `${year}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + 1;
        }
    });

    return monthlyStats;
}

// Funkcija za godišnju statistiku
export function getYearlyStats(students: any[]): { [year: string]: number } {
    const yearlyStats: { [year: string]: number } = {};

    students.forEach(student => {
        const year = new Date(student.createdAt).getFullYear().toString();
        yearlyStats[year] = (yearlyStats[year] || 0) + 1;
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

export function getAvailableYears(students: any[]): number[] {
    const years = new Set<number>();

    students.forEach(student => {
        const year = new Date(student.createdAt).getFullYear();
        years.add(year);
    });

    return Array.from(years).sort((a, b) => b - a); // Sortiraj opadajuće
}