import { TripStatus } from '../generated/prisma/enums';

/**
 * Sugere mudança de status baseado nas datas.
 * Só sugere, não altera nada no banco.
 */
export function suggestTripStatus(
    current: TripStatus,
    startDate: Date,
    endDate: Date,
    now: Date = new Date(),
): TripStatus | null {
    if (current === TripStatus.COMPLETED) return null;

    const today = startOfDay(now);

    if (today > startOfDay(endDate)) return TripStatus.COMPLETED;

    if (current === TripStatus.PLANNING && today >= startOfDay(startDate)) {
        return TripStatus.ONGOING;
    }

    return null;
}

function startOfDay(date: Date): number {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function hasNotStarted(startDate: Date, now: Date = new Date()): boolean {
    return startOfDay(now) < startOfDay(startDate);
}