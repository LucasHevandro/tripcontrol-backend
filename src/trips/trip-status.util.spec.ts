import { TripStatus } from '../generated/prisma/enums';
import { suggestTripStatus, hasNotStarted } from './trip-status.util';

const start = new Date('2026-07-10T00:00:00.000Z');
const end = new Date('2026-07-17T00:00:00.000Z');
const at = (iso: string) => new Date(iso);

describe('suggestTripStatus', () => {
    it('não sugere nada antes da data de início', () => {
        expect(
            suggestTripStatus(TripStatus.PLANNING, start, end, at('2026-07-09T23:00:00Z')),
        ).toBeNull();
    });

    it('sugere ONGOING no dia do início e durante a viagem', () => {
        expect(
            suggestTripStatus(TripStatus.PLANNING, start, end, at('2026-07-10T03:00:00Z')),
        ).toBe(TripStatus.ONGOING);
        expect(
            suggestTripStatus(TripStatus.PLANNING, start, end, at('2026-07-14T12:00:00Z')),
        ).toBe(TripStatus.ONGOING);
    });

    it('não sugere nada quando já está ONGOING dentro do período', () => {
        expect(
            suggestTripStatus(TripStatus.ONGOING, start, end, at('2026-07-14T12:00:00Z')),
        ).toBeNull();
    });

    it('não sugere COMPLETED no último dia da viagem', () => {
        expect(
            suggestTripStatus(TripStatus.ONGOING, start, end, at('2026-07-17T23:00:00Z')),
        ).toBeNull();
    });

    it('sugere COMPLETED depois do fim, mesmo se ficou em PLANNING', () => {
        expect(
            suggestTripStatus(TripStatus.ONGOING, start, end, at('2026-07-18T01:00:00Z')),
        ).toBe(TripStatus.COMPLETED);
        expect(
            suggestTripStatus(TripStatus.PLANNING, start, end, at('2026-08-01T12:00:00Z')),
        ).toBe(TripStatus.COMPLETED);
    });

    it('nunca sugere nada para viagem já concluída', () => {
        expect(
            suggestTripStatus(TripStatus.COMPLETED, start, end, at('2026-08-01T12:00:00Z')),
        ).toBeNull();
    });
});

describe('hasNotStarted', () => {
    it('é verdadeiro antes do dia de início', () => {
        expect(hasNotStarted(start, at('2026-07-09T23:00:00Z'))).toBe(true);
    });

    it('é falso no dia de início e depois', () => {
        expect(hasNotStarted(start, at('2026-07-10T00:30:00Z'))).toBe(false);
        expect(hasNotStarted(start, at('2026-08-01T12:00:00Z'))).toBe(false);
    });
});