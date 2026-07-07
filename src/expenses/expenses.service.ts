import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TripsService } from '../trips/trips.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { SplitType } from '../generated/prisma/client';

@Injectable()
export class ExpensesService {
    constructor(
        private prisma: PrismaService,
        private tripsService: TripsService,
    ) { }

    // ─── Listar despesas ──────────────────────────────────────────────────────
    async findAll(
        userId: string,
        tripId: string,
        category?: string,
        page: number = 1,
        limit: number = 20,
    ) {
        await this.tripsService.assertParticipant(userId, tripId);

        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const [expenses, total] = await Promise.all([
            this.prisma.expense.findMany({
                where: {
                    tripId,
                    ...(category ? { category } : {}),
                },
                include: {
                    paidBy: { select: { id: true, name: true, avatarUrl: true } },
                    splits: {
                        include: {
                            participant: {
                                include: {
                                    user: { select: { id: true, name: true } },
                                },
                            },
                        },
                    },
                },
                orderBy: { date: 'desc' },
                skip,
                take,
            }),
            this.prisma.expense.count({
                where: {
                    tripId,
                    ...(category ? { category } : {}),
                },
            }),
        ]);

        return {
            data: expenses.map((e) => ({
                id: e.id,
                description: e.description,
                category: e.category,
                amount: Number(e.amount),
                date: e.date.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                }),
                paidById: e.paidById,
                paidByName: e.paidBy.name,
                splitType: e.splitType,
                notes: e.notes,
                receiptUrl: e.receiptUrl,
                splits: e.splits.map((s) => ({
                    participantId: s.participantId,
                    participantName: s.participant.user.name,
                    amount: Number(s.amount),
                })),
            })),
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        };
    }

    // ─── Resumo financeiro ────────────────────────────────────────────────────

    async getSummary(userId: string, tripId: string) {
        await this.tripsService.assertParticipant(userId, tripId);

        const trip = await this.prisma.trip.findUnique({
            where: { id: tripId },
            select: { name: true, startDate: true },
        });

        if (!trip) throw new NotFoundException('Viagem não encontrada');

        const expenses = await this.prisma.expense.findMany({
            where: { tripId },
            include: {
                paidBy: { select: { id: true, name: true } },
            },
        });

        const participantCount = await this.prisma.tripParticipant.count({
            where: { tripId },
        });

        const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const perPersonAverage =
            participantCount > 0 ? totalSpent / participantCount : 0;

        // Maior despesa
        const largest = expenses.reduce(
            (max, e) => (Number(e.amount) > Number(max?.amount ?? 0) ? e : max),
            expenses[0],
        );

        // Gastos por categoria
        const categoryMap = new Map<string, number>();
        expenses.forEach((e) => {
            const current = categoryMap.get(e.category) ?? 0;
            categoryMap.set(e.category, current + Number(e.amount));
        });

        const categoryBreakdown = Array.from(categoryMap.entries())
            .map(([category, total]) => ({
                category,
                total: Math.round(total * 100) / 100,
                percentage:
                    totalSpent > 0 ? Math.round((total / totalSpent) * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total);

        return {
            tripName: trip.name,
            tripPeriod: trip.startDate.toLocaleDateString('pt-BR', {
                month: 'short',
                year: 'numeric',
            }),
            totalSpent: Math.round(totalSpent * 100) / 100,
            expenseCount: expenses.length,
            perPersonAverage: Math.round(perPersonAverage * 100) / 100,
            participantCount,
            largestExpenseAmount: largest ? Number(largest.amount) : 0,
            largestExpenseDescription: largest?.description ?? '',
            groupBalanceLabel: 'Equilibrado',
            categoryBreakdown,
        };
    }

    // ─── Criar despesa ────────────────────────────────────────────────────────

    async create(userId: string, tripId: string, dto: CreateExpenseDto) {
        await this.tripsService.assertParticipant(userId, tripId);

        const payer = await this.prisma.tripParticipant.findUnique({
            where: { tripId_userId: { tripId, userId: dto.paidById } },
        });
        if (!payer) throw new BadRequestException('Pagador não é participante da viagem');

        const allParticipants = await this.prisma.tripParticipant.findMany({
            where: { tripId },
        });

        const splitType = dto.splitType ?? SplitType.EQUAL;
        let splits: { participantId: string; amount: number }[] = [];

        if (splitType === SplitType.EQUAL) {
            let tripParticipantIds: string[];

            if (dto.splitParticipants && dto.splitParticipants.length > 0) {
                // Frontend manda userIds — converte para TripParticipant.id
                const found = await this.prisma.tripParticipant.findMany({
                    where: {
                        tripId,
                        userId: { in: dto.splitParticipants.map((s) => s.participantId) },
                    },
                    select: { id: true },
                });
                tripParticipantIds = found.map((p) => p.id);
            } else {
                // Divide entre todos — já são TripParticipant.ids
                tripParticipantIds = allParticipants.map((p) => p.id);
            }

            if (tripParticipantIds.length === 0) {
                throw new BadRequestException(
                    'Nenhum participante válido encontrado para divisão',
                );
            }

            const amountPerPerson = dto.amount / tripParticipantIds.length;
            splits = tripParticipantIds.map((participantId) => ({
                participantId,
                amount: Math.round(amountPerPerson * 100) / 100,
            }));
        } else {
            if (!dto.splitParticipants || dto.splitParticipants.length === 0) {
                throw new BadRequestException(
                    'Divisão customizada requer os valores por participante',
                );
            }

            const totalSplit = dto.splitParticipants.reduce(
                (sum, s) => sum + (s.amount ?? 0),
                0,
            );

            if (Math.abs(totalSplit - dto.amount) > 0.01) {
                throw new BadRequestException(
                    'A soma dos valores individuais deve ser igual ao total da despesa',
                );
            }

            // Converte userIds → TripParticipant.ids para divisão customizada também
            const found = await this.prisma.tripParticipant.findMany({
                where: {
                    tripId,
                    userId: { in: dto.splitParticipants.map((s) => s.participantId) },
                },
                select: { id: true, userId: true },
            });

            const participantMap = new Map(found.map((p) => [p.userId, p.id]));

            splits = dto.splitParticipants.map((s) => ({
                participantId: participantMap.get(s.participantId) ?? s.participantId,
                amount: s.amount!,
            }));
        }

        const expense = await this.prisma.expense.create({
            data: {
                tripId,
                paidById: dto.paidById,
                description: dto.description,
                amount: dto.amount,
                date: new Date(dto.date),
                category: dto.category,
                splitType,
                notes: dto.notes,
                splits: { create: splits },
            },
            include: {
                paidBy: { select: { id: true, name: true } },
                splits: {
                    include: {
                        participant: {
                            include: { user: { select: { id: true, name: true } } },
                        },
                    },
                },
            },
        });

        return {
            id: expense.id,
            description: expense.description,
            category: expense.category,
            amount: Number(expense.amount),
            date: expense.date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
            }),
            paidByName: expense.paidBy.name,
            splitType: expense.splitType,
            splits: expense.splits.map((s) => ({
                participantId: s.participantId,
                participantName: s.participant.user.name,
                amount: Number(s.amount),
            })),
        };
    }

    // ─── Atualizar despesa ────────────────────────────────────────────────────

    async update(
        userId: string,
        tripId: string,
        expenseId: string,
        dto: UpdateExpenseDto,
    ) {
        await this.tripsService.assertParticipant(userId, tripId);
        await this.assertExpenseOwner(userId, expenseId, tripId);

        const { splitParticipants, splitType, amount, date, ...rest } = dto;

        return this.prisma.expense.update({
            where: { id: expenseId },
            data: {
                ...rest,
                ...(amount ? { amount } : {}),
                ...(date ? { date: new Date(date) } : {}),
            },
            include: {
                paidBy: { select: { id: true, name: true } },
            },
        });
    }

    // ─── Deletar despesa ──────────────────────────────────────────────────────

    async remove(userId: string, tripId: string, expenseId: string) {
        await this.tripsService.assertParticipant(userId, tripId);
        await this.assertExpenseOwner(userId, expenseId, tripId);

        await this.prisma.expense.delete({ where: { id: expenseId } });
        return { message: 'Despesa removida com sucesso' };
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private async assertExpenseOwner(
        userId: string,
        expenseId: string,
        tripId: string,
    ) {
        const expense = await this.prisma.expense.findUnique({
            where: { id: expenseId },
        });

        if (!expense || expense.tripId !== tripId) {
            throw new NotFoundException('Despesa não encontrada');
        }

        // Organizador pode editar qualquer despesa, membro só a própria
        const participation = await this.prisma.tripParticipant.findUnique({
            where: { tripId_userId: { tripId, userId } },
        });

        if (expense.paidById !== userId && participation?.role !== 'ORGANIZER') {
            throw new ForbiddenException(
                'Você só pode editar despesas que você registrou',
            );
        }

        return expense;
    }
    async uploadReceipt(
        userId: string,
        tripId: string,
        expenseId: string,
        file: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('Nenhum arquivo enviado');

        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.mimetype)) {
            throw new BadRequestException('Formato não suportado. Use JPG, PNG ou PDF');
        }

        await this.assertExpenseOwner(userId, expenseId, tripId);

        const receiptUrl = `/uploads/receipts/${file.filename}`;

        const expense = await this.prisma.expense.update({
            where: { id: expenseId },
            data: { receiptUrl },
            select: { id: true, receiptUrl: true },
        });

        return { id: expense.id, receiptUrl: expense.receiptUrl };
    }
}