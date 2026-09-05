import {
    dateOnlyParts,
    formatDateOnly,
    todayInAppTimeZone,
    todayRangeUtc,
} from './date.util';

describe('date.util', () => {
    const dateOnly = new Date('2026-07-10T00:00:00.000Z');

    it('formata data sem hora no dia correto, independente do fuso do servidor', () => {
        expect(formatDateOnly(dateOnly, { day: '2-digit', month: '2-digit' })).toBe(
            '10/07',
        );
        expect(dateOnlyParts(dateOnly)).toEqual({ day: 10, month: 7, year: 2026 });
    });

    it('usa o dia brasileiro depois das 21h UTC-3', () => {
        // 23h em São Paulo do dia 04 = 02h UTC do dia 05
        expect(todayInAppTimeZone(new Date('2026-09-05T02:00:00.000Z'))).toBe(
            '2026-09-04',
        );
    });

    it('usa o dia seguinte a partir da meia-noite brasileira', () => {
        expect(todayInAppTimeZone(new Date('2026-09-05T03:30:00.000Z'))).toBe(
            '2026-09-05',
        );
    });

    it('monta o intervalo UTC do dia brasileiro atual', () => {
        const range = todayRangeUtc(new Date('2026-09-05T02:00:00.000Z'));
        expect(range.gte.toISOString()).toBe('2026-09-04T00:00:00.000Z');
        expect(range.lte.toISOString()).toBe('2026-09-04T23:59:59.999Z');
    });
});