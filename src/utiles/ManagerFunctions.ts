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

/**
 * Jedna stavka statistike — koliko je učenika upisano u tom periodu i
 * koliki prihod donose.
 *
 * "Prihod" je zbir ŠKOLARINA tih učenika, dakle koliko su zaduženi, a ne
 * koliko je naplaćeno. Ista definicija se koristi i za "Укупан приход",
 * pa zbir stavki uvek daje ukupan iznos.
 */
export interface StavkaStatistike {
    brojUcenika: number;
    prihod: number;
}

function prazna(): StavkaStatistike {
    return { brojUcenika: 0, prihod: 0 };
}

/** Dodaje jednog učenika u stavku pod datim ključem. */
function dodaj(
    mapa: { [kljuc: string]: StavkaStatistike },
    kljuc: string,
    student: any
): void {
    if (!mapa[kljuc]) mapa[kljuc] = prazna();
    mapa[kljuc].brojUcenika += 1;
    mapa[kljuc].prihod += Number(student.cenaSkolarine) || 0;
}

/** Zaokružuje prihode na dve decimale, zbog sabiranja decimalnih iznosa. */
function zaokruzi(mapa: { [kljuc: string]: StavkaStatistike }) {
    for (const kljuc of Object.keys(mapa)) {
        mapa[kljuc].prihod = parseFloat(mapa[kljuc].prihod.toFixed(2));
    }
    return mapa;
}

/** Ključ meseca u obliku "2025-09". */
function kljucMeseca(datum: Date): string {
    return `${datum.getFullYear()}-${(datum.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;
}

// Mesečna statistika za jednu ŠKOLSKU godinu (septembar -> avgust)
export function getMonthlyStatsForYear(
    students: any[],
    schoolYearStart: number
): { [monthKey: string]: StavkaStatistike } {
    const monthlyStats: { [monthKey: string]: StavkaStatistike } = {};

    // Inicijalizuj sve mesece školske godine sa nulom (redom od septembra)
    for (const { month, year } of getSchoolYearMonths(schoolYearStart)) {
        monthlyStats[`${year}-${month.toString().padStart(2, '0')}`] = prazna();
    }

    // Popuni stvarnim podacima
    students.forEach(student => {
        const date = new Date(student.createdAt);
        if (getSchoolYearForDate(date) === schoolYearStart) {
            dodaj(monthlyStats, kljucMeseca(date), student);
        }
    });

    return zaokruzi(monthlyStats);
}

// Statistika po ŠKOLSKIM godinama, npr. { "2025/2026": { brojUcenika: 15, prihod: 22500 } }
export function getYearlyStats(students: any[]): {
    [year: string]: StavkaStatistike;
} {
    const yearlyStats: { [year: string]: StavkaStatistike } = {};

    students.forEach(student => {
        const label = getSchoolYearLabel(
            getSchoolYearForDate(new Date(student.createdAt))
        );
        dodaj(yearlyStats, label, student);
    });

    return zaokruzi(yearlyStats);
}

// Funkcija za mesečnu statistiku
export function getMonthlyStats(students: any[]): {
    [monthKey: string]: StavkaStatistike;
} {
    const monthlyStats: { [monthKey: string]: StavkaStatistike } = {};

    students.forEach(student => {
        dodaj(monthlyStats, kljucMeseca(new Date(student.createdAt)), student);
    });

    return zaokruzi(monthlyStats);
}

// Dostupne ŠKOLSKE godine (vraća početne godine, npr. [2025, 2024])
export function getAvailableYears(students: any[]): number[] {
    const years = new Set<number>();

    students.forEach(student => {
        years.add(getSchoolYearForDate(new Date(student.createdAt)));
    });

    return Array.from(years).sort((a, b) => b - a); // Sortiraj opadajuće
}
