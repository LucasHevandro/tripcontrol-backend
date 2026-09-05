/** Fuso usado para decidir "hoje" no servidor (o Railway roda em UTC) */
export const APP_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Datas sem hora (Trip.startDate, Expense.date, RoadmapActivity.date) chegam
 * como "YYYY-MM-DD" e são gravadas como meia-noite UTC. Formatá-las no fuso do
 * servidor deslocaria o dia (meia-noite UTC = 21h do dia anterior no Brasil),
 * então toda formatação dessas datas é feita em UTC.
 */
export function formatDateOnly(
    date: Date,
    options: Intl.DateTimeFormatOptions,
    locale = 'pt-BR',
): string {
    return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: 'UTC',
    }).format(date);
}

/** Partes (dia, mês, ano) de uma data sem hora, lidas em UTC */
export function dateOnlyParts(date: Date) {
    return {
        day: date.getUTCDate(),
        month: date.getUTCMonth() + 1,
        year: date.getUTCFullYear(),
    };
}

/** Data de hoje no fuso da aplicação, no formato "YYYY-MM-DD" */
export function todayInAppTimeZone(now: Date = new Date()): string {
    // en-CA produz exatamente YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}

/**
 * Intervalo UTC que corresponde ao dia de hoje no fuso da aplicação.
 * Usado para filtrar registros com data sem hora (gravados à meia-noite UTC).
 */
export function todayRangeUtc(now: Date = new Date()): { gte: Date; lte: Date } {
    const today = todayInAppTimeZone(now);
    return {
        gte: new Date(`${today}T00:00:00.000Z`),
        lte: new Date(`${today}T23:59:59.999Z`),
    };
}