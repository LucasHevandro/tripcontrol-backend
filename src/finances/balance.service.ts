import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SplitType } from '../generated/prisma/enums';

export interface ParticipantIdentity {
    /** TripParticipant.id — usado em splits e payments */
    id: string;
    /** User.id — usado em paidExpenses */
    userId: string;
}

export interface ParticipantBalance {
    totalPaid: number;
    individualQuota: number;
    totalPaidToOthers: number;
    totalReceivedFromOthers: number;
    balance: number;
}

@Injectable()
export class BalanceCalculatorService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Calcula os saldos de todos os participantes de uma viagem em batch.
     *
     * Fórmula por participante:
     *   balance = totalPaid                    // pagou em despesas do grupo (exclui INDIVIDUAL)
     *           - individualQuota              // cota nas despesas compartilhadas
     *           + totalPaidToOthers            // já pagou aos credores (reduz dívida)
     *           - totalReceivedFromOthers      // já recebeu de devedores (reduz crédito)
     *
     * Estratégia: 3 queries totais (paralelas) + agregação em memória.
     *
     * @returns Map onde a chave é o TripParticipant.id
     */
    async calculateBalances(
        tripId: string,
        participants: ParticipantIdentity[],
    ): Promise<Map<string, ParticipantBalance>> {
        const participantIds = participants.map((p) => p.id);

        const [expenses, splits, payments] = await Promise.all([
            this.prisma.expense.findMany({
                where: {
                    tripId,
                    splitType: { not: SplitType.INDIVIDUAL },
                },
                select: { paidById: true, amount: true },
            }),
            this.prisma.expenseSplit.findMany({
                where: { participantId: { in: participantIds } },
                select: { participantId: true, amount: true },
            }),
            this.prisma.payment.findMany({
                where: { tripId },
                select: {
                    fromParticipantId: true,
                    toParticipantId: true,
                    amount: true,
                },
            }),
        ]);

        const paidByUser = sumBy(expenses, (e) => e.paidById, (e) => e.amount);
        const owedByParticipant = sumBy(splits, (s) => s.participantId, (s) => s.amount);
        const paidToOthers = sumBy(
            payments,
            (p) => p.fromParticipantId,
            (p) => p.amount,
        );
        const receivedFromOthers = sumBy(
            payments,
            (p) => p.toParticipantId,
            (p) => p.amount,
        );

        const result = new Map<string, ParticipantBalance>();

        for (const p of participants) {
            const totalPaid = paidByUser.get(p.userId) ?? 0;
            const individualQuota = owedByParticipant.get(p.id) ?? 0;
            const totalPaidToOthers = paidToOthers.get(p.id) ?? 0;
            const totalReceivedFromOthers = receivedFromOthers.get(p.id) ?? 0;

            const balance =
                totalPaid -
                individualQuota +
                totalPaidToOthers -
                totalReceivedFromOthers;

            result.set(p.id, {
                totalPaid: round(totalPaid),
                individualQuota: round(individualQuota),
                totalPaidToOthers: round(totalPaidToOthers),
                totalReceivedFromOthers: round(totalReceivedFromOthers),
                balance: round(balance),
            });
        }

        return result;
    }
}

/** Agrupa itens por chave e soma o valor. Substitui o padrão de 3 blocos idênticos de forEach. */
function sumBy<T>(
    items: T[],
    keyFn: (item: T) => string,
    valueFn: (item: T) => number | { toString(): string },
): Map<string, number> {
    const map = new Map<string, number>();
    for (const item of items) {
        const key = keyFn(item);
        map.set(key, (map.get(key) ?? 0) + Number(valueFn(item)));
    }
    return map;
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}