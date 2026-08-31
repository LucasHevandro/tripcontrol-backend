import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceCalculatorService } from '../finances/balance.service';
import { SplitType } from '../generated/prisma/enums';
import { buildTripReportPdf } from './pdf-builder';

export interface ExpenseRow {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
    splitType: 'EQUAL' | 'CUSTOM' | 'INDIVIDUAL';
    paidByName: string;
}

export interface CategoryTotal {
    category: string;
    total: number;
    count: number;
    percentage: number;
}

export interface ParticipantRow {
    id: string;
    name: string;
    totalPaid: number;
    individualQuota: number;
    balance: number;
    isOrganizer: boolean;
}

export interface SettlementRow {
    fromName: string;
    toName: string;
    amount: number;
}

export interface PaymentRow {
    fromName: string;
    toName: string;
    amount: number;
    paidAt: string;
}

export interface TripReportData {
    trip: {
        name: string;
        destination: string;
        startDate: Date;
        endDate: Date;
        description: string | null;
        budget: number | null;
    };
    userLanguage: string;
    userCurrency: string;
    totalSpent: number;
    perPersonAverage: number;
    categoryTotals: CategoryTotal[];
    expenses: ExpenseRow[];
    participants: ParticipantRow[];
    settlements: SettlementRow[];
    payments: PaymentRow[];
}

@Injectable()
export class ReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly balanceCalc: BalanceCalculatorService,
    ) { }

    async generateTripReportPdf(tripId: string, userId: string): Promise<Buffer> {
        const data = await this.gatherData(tripId, userId);
        return buildTripReportPdf(data);
    }

    private async gatherData(tripId: string, userId: string): Promise<TripReportData> {
        // 1. Trip + verificação de acesso
        const trip = await this.prisma.trip.findUnique({
            where: { id: tripId },
            include: {
                participants: {
                    include: {
                        user: { select: { id: true, name: true } },
                    },
                },
                expenses: {
                    include: {
                        paidBy: { select: { name: true } },
                    },
                    orderBy: { date: 'desc' },
                },
                payments: {
                    include: {
                        fromParticipant: { include: { user: { select: { name: true } } } },
                        toParticipant: { include: { user: { select: { name: true } } } },
                    },
                    orderBy: { paidAt: 'desc' },
                },
            },
        });

        if (!trip) throw new NotFoundException('Viagem não encontrada');

        const isMember = trip.participants.some((p) => p.userId === userId);
        if (!isMember) {
            throw new ForbiddenException('Você não tem acesso a essa viagem');
        }

        // 2. Preferências do usuário
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { language: true, currency: true },
        });

        // 3. Balances (usa o service compartilhado)
        const balancesMap = await this.balanceCalc.calculateBalances(
            tripId,
            trip.participants.map((p) => ({ id: p.id, userId: p.userId })),
        );

        // 4. Estatísticas de despesas
        const totalSpent = trip.expenses.reduce(
            (sum, e) => sum + Number(e.amount),
            0,
        );
        const sharedTotal = trip.expenses
            .filter((e) => e.splitType !== SplitType.INDIVIDUAL)
            .reduce((sum, e) => sum + Number(e.amount), 0);
        const perPersonAverage =
            trip.participants.length > 0 ? sharedTotal / trip.participants.length : 0;

        // 5. Agrupamento por categoria
        const categoryMap = new Map<string, { total: number; count: number }>();
        for (const e of trip.expenses) {
            const cur = categoryMap.get(e.category) ?? { total: 0, count: 0 };
            cur.total += Number(e.amount);
            cur.count += 1;
            categoryMap.set(e.category, cur);
        }
        const categoryTotals: CategoryTotal[] = Array.from(categoryMap.entries())
            .map(([category, v]) => ({
                category,
                total: round(v.total),
                count: v.count,
                percentage: totalSpent > 0 ? round((v.total / totalSpent) * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total);

        // 6. Participantes com balance
        const participantsRow: ParticipantRow[] = trip.participants.map((p) => {
            const b = balancesMap.get(p.id)!;
            return {
                id: p.user.id,
                name: shortName(p.user.name),
                totalPaid: b.totalPaid,
                individualQuota: b.individualQuota,
                balance: b.balance,
                isOrganizer: p.role === 'ORGANIZER',
            };
        });

        // 7. Settlements (algoritmo simples de two-pointer)
        const settlements = calculateSettlements(participantsRow);

        // 8. Payments formatados
        const payments: PaymentRow[] = trip.payments.map((p) => ({
            fromName: shortName(p.fromParticipant.user.name),
            toName: shortName(p.toParticipant.user.name),
            amount: Number(p.amount),
            paidAt: p.paidAt.toISOString(),
        }));

        // 9. Expenses formatadas
        const expenses: ExpenseRow[] = trip.expenses.map((e) => ({
            id: e.id,
            description: e.description,
            amount: Number(e.amount),
            date: e.date.toISOString(),
            category: e.category,
            splitType: e.splitType as ExpenseRow['splitType'],
            paidByName: e.paidBy?.name ?? '—',
        }));

        return {
            trip: {
                name: trip.name,
                destination: trip.destination,
                startDate: trip.startDate,
                endDate: trip.endDate,
                description: trip.description,
                budget: trip.budget ? Number(trip.budget) : null,
            },
            userLanguage: user?.language ?? 'pt-BR',
            userCurrency: user?.currency ?? 'BRL',
            totalSpent: round(totalSpent),
            perPersonAverage: round(perPersonAverage),
            categoryTotals,
            expenses,
            participants: participantsRow,
            settlements,
            payments,
        };
    }
}

function calculateSettlements(participants: ParticipantRow[]): SettlementRow[] {
    const creditors = participants
        .filter((p) => p.balance > 0.01)
        .map((p) => ({ name: p.name, amount: p.balance }))
        .sort((a, b) => b.amount - a.amount);
    const debtors = participants
        .filter((p) => p.balance < -0.01)
        .map((p) => ({ name: p.name, amount: -p.balance }))
        .sort((a, b) => b.amount - a.amount);

    const settlements: SettlementRow[] = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const settled = Math.min(debtor.amount, creditor.amount);
        settlements.push({
            fromName: debtor.name,
            toName: creditor.name,
            amount: round(settled),
        });
        debtor.amount -= settled;
        creditor.amount -= settled;
        if (debtor.amount < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }
    return settlements;
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

function shortName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}