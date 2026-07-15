// Školska godina traje od 1. septembra do 31. avgusta naredne godine.
// "startYear" je godina u kojoj školska godina POČINJE (npr. 2025 = školska 2025/26).

export function getSchoolYearRange(startYear: number): { start: Date; end: Date } {
    return {
        start: new Date(startYear, 8, 1, 0, 0, 0, 0),          // 1. septembar
        end: new Date(startYear + 1, 7, 31, 23, 59, 59, 999),  // 31. avgust naredne godine
    };
}

// Za dati datum vraća početnu godinu školske godine kojoj datum pripada
// (septembar-decembar -> ista godina, januar-avgust -> prethodna godina)
export function getSchoolYearForDate(date: Date): number {
    return date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
}

export function getSchoolYearLabel(startYear: number): string {
    return `${startYear}/${startYear + 1}`;
}

// Meseci školske godine redom: septembar..decembar (startYear), januar..avgust (startYear+1)
export function getSchoolYearMonths(startYear: number): { month: number; year: number }[] {
    const months: { month: number; year: number }[] = [];
    for (let m = 9; m <= 12; m++) months.push({ month: m, year: startYear });
    for (let m = 1; m <= 8; m++) months.push({ month: m, year: startYear + 1 });
    return months;
}
