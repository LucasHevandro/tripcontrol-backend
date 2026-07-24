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
import { SplitType } from '../generated/prisma/enums';
import { CreatePaymentDto } from './dto/create-payment-dto';
import { buildExpenseSplits } from './expense-splits.util';
import { BalanceCalculatorService } from '../finances/balance.service';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private tripsService: TripsService,
    private balanceCalc: BalanceCalculatorService,
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
      select: { name: true, startDate: true, budget: true },
    });

    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const expenses = await this.prisma.expense.findMany({
      where: { tripId },
      include: {
        paidBy: { select: { id: true, name: true } },
      },
    });

    const tripParticipants = await this.prisma.tripParticipant.findMany({
      where: { tripId },
      select: { id: true, userId: true },
    });
    const participantCount = tripParticipants.length;

    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const sharedTotal = expenses
      .filter((e) => e.splitType !== SplitType.INDIVIDUAL)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const perPersonAverage =
      participantCount > 0 ? sharedTotal / participantCount : 0;

    const largest = expenses.reduce(
      (max, e) => (Number(e.amount) > Number(max?.amount ?? 0) ? e : max),
      expenses[0],
    );

    const categoryMap = new Map<string, number>();
    expenses.forEach((e) => {
      const current = categoryMap.get(e.category) ?? 0;
      categoryMap.set(e.category, current + Number(e.amount));
    });

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, total]) => ({
        category,
        total: Math.round(total * 100) / 100,
        percentage: totalSpent > 0 ? Math.round((total / totalSpent) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const budget = Number(trip.budget);
    const isOverBudget = budget > 0 && totalSpent > budget;

    const balances = await this.balanceCalc.calculateBalances(
      tripId,
      tripParticipants,
    );
    const hasPendingSettlements = Array.from(balances.values()).some(
      (b) => Math.abs(b.balance) > 0.01,
    );

    const groupBalanceLabel = isOverBudget
      ? 'Estourado'
      : hasPendingSettlements
        ? 'Pendente'
        : 'Equilibrado';

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
      budget,
      groupBalanceLabel,
      categoryBreakdown,
    };
  }

  // ─── Criar despesa ────────────────────────────────────────────────────────

  async create(userId: string, tripId: string, dto: CreateExpenseDto) {
    await this.tripsService.assertParticipant(userId, tripId);

    const allParticipants = await this.prisma.tripParticipant.findMany({
      where: { tripId },
      select: { id: true, userId: true, sponsorId: true },
    });

    const payer = allParticipants.find(
      (participant) => participant.userId === dto.paidById,
    );
    if (!payer) {
      throw new BadRequestException('Pagador não é participante da viagem');
    }

    const splitType = dto.splitType ?? SplitType.EQUAL;
    const splits = buildExpenseSplits({
      amount: dto.amount,
      splitType,
      splitParticipants: dto.splitParticipants,
      tripParticipants: allParticipants,
    });

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
    const expense = await this.assertExpenseOwner(userId, expenseId, tripId);

    const { splitParticipants, splitType, amount, date, paidById, ...rest } =
      dto;
    const shouldRebuildSplits =
      amount !== undefined ||
      splitType !== undefined ||
      splitParticipants !== undefined;
    const nextAmount = amount ?? Number(expense.amount);
    const nextSplitType = splitType ?? expense.splitType;

    const participants =
      shouldRebuildSplits || paidById
        ? await this.prisma.tripParticipant.findMany({
          where: { tripId },
          select: { id: true, userId: true, sponsorId: true },
        })
        : [];

    if (
      paidById &&
      !participants.some((participant) => participant.userId === paidById)
    ) {
      throw new BadRequestException('Pagador não é participante da viagem');
    }

    const splits = shouldRebuildSplits
      ? buildExpenseSplits({
        amount: nextAmount,
        splitType: nextSplitType,
        splitParticipants,
        tripParticipants: participants,
      })
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (splits) {
        await tx.expenseSplit.deleteMany({ where: { expenseId } });
      }

      return tx.expense.update({
        where: { id: expenseId },
        data: {
          ...rest,
          ...(paidById ? { paidById } : {}),
          ...(amount !== undefined ? { amount } : {}),
          ...(splitType ? { splitType } : {}),
          ...(date ? { date: new Date(date) } : {}),
          ...(splits ? { splits: { create: splits } } : {}),
        },
        include: {
          paidBy: { select: { id: true, name: true } },
          splits: true,
        },
      });
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
      throw new BadRequestException(
        'Formato não suportado. Use JPG, PNG ou PDF',
      );
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

  async createPayment(tripId: string, userId: string, dto: CreatePaymentDto) {
    // Resolve userIds → TripParticipant.ids
    const [from, to] = await Promise.all([
      this.prisma.tripParticipant.findFirst({
        where: { userId: dto.fromUserId, tripId },
      }),
      this.prisma.tripParticipant.findFirst({
        where: { userId: dto.toUserId, tripId },
      }),
    ]);
    if (!from || !to) {
      throw new NotFoundException('Participante não encontrado nessa viagem');
    }

    // Não permitir pagar a si mesmo
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException(
        'Devedor e credor não podem ser a mesma pessoa',
      );
    }

    // Autorização: só o devedor pode registrar
    if (from.userId !== userId) {
      throw new ForbiddenException(
        'Só o próprio devedor pode marcar como pago',
      );
    }

    return this.prisma.payment.create({
      data: {
        tripId,
        fromParticipantId: from.id, // TripParticipant.id resolvido
        toParticipantId: to.id, // TripParticipant.id resolvido
        amount: dto.amount,
        createdBy: userId,
        notes: dto.notes,
      },
    });
  }

  async findAllPayments(tripId: string, userId: string) {
    // Autorização: só participante da viagem pode ver o histórico
    await this.assertMember(tripId, userId);

    const payments = await this.prisma.payment.findMany({
      where: { tripId },
      include: {
        fromParticipant: {
          select: {
            id: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        toParticipant: {
          select: {
            id: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    return payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      paidAt: p.paidAt.toISOString(),
      notes: p.notes,
      canDelete: p.createdBy === userId,
      from: {
        userId: p.fromParticipant.user.id,
        name: p.fromParticipant.user.name,
        avatarUrl: p.fromParticipant.user.avatarUrl,
      },
      to: {
        userId: p.toParticipant.user.id,
        name: p.toParticipant.user.name,
        avatarUrl: p.toParticipant.user.avatarUrl,
      },
    }));
  }

  async deletePayment(tripId: string, paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tripId },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');

    if (payment.createdBy !== userId) {
      throw new ForbiddenException(
        'Só quem registrou o pagamento pode desfazê-lo',
      );
    }

    await this.prisma.payment.delete({ where: { id: paymentId } });
  }

  private async assertMember(tripId: string, userId: string): Promise<void> {
    const participant = await this.prisma.tripParticipant.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException('Você não é participante dessa viagem');
    }
  }
}
