import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { TripStatus } from '../generated/prisma/enums';
import { BalanceCalculatorService } from '../finances/balance.service';

@Injectable()
export class TripsService {
  constructor(
    private prisma: PrismaService,
    private balanceCalc: BalanceCalculatorService,
  ) {}

  // ─── Listar viagens do usuário ────────────────────────────────────────────

  async findAll(userId: string) {
    const participations = await this.prisma.tripParticipant.findMany({
      where: { userId },
      include: {
        trip: {
          include: {
            participants: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
              take: 3,
            },
            _count: { select: { participants: true } },
            expenses: { select: { amount: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const trips = participations.map(({ trip, role }) => {
      const totalSpent = trip.expenses.reduce(
        (sum, e) => sum + Number(e.amount),
        0,
      );

      const visibleParticipants = trip.participants.map((p) => ({
        id: p.user.id,
        name: p.user.name,
        avatarUrl: p.user.avatarUrl,
      }));

      const totalParticipants = trip._count.participants;
      const extraCount = Math.max(0, totalParticipants - 3);

      return {
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        status: trip.status,
        emoji: trip.emoji,
        participants: visibleParticipants,
        extraParticipantCount: extraCount,
        totalSpent,
        budget: trip.budget ? Number(trip.budget) : 0,
        role,
      };
    });

    const activeTripCount = trips.filter(
      (t) => t.status !== TripStatus.COMPLETED,
    ).length;
    const completedTripCount = trips.filter(
      (t) => t.status === TripStatus.COMPLETED,
    ).length;

    return { activeTripCount, completedTripCount, trips };
  }

  // ─── Criar viagem ─────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateTripDto) {
    const trip = await this.prisma.trip.create({
      data: {
        name: dto.name,
        destination: dto.destination,
        destinationLat: dto.destinationLat,
        destinationLng: dto.destinationLng,
        destinationType: dto.destinationType,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        tripType: dto.tripType,
        budget: dto.budget,
        description: dto.description,
        emoji: dto.emoji,
        status: TripStatus.PLANNING,
        participants: {
          create: {
            userId,
            role: 'ORGANIZER',
          },
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return trip;
  }

  // ─── Buscar uma viagem ────────────────────────────────────────────────────

  async findOne(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!trip) throw new NotFoundException('Viagem não encontrada');

    await this.assertParticipant(userId, tripId);

    return trip;
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  async getDashboard(userId: string, tripId: string) {
    await this.assertParticipant(userId, tripId);

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        expenses: {
          orderBy: { createdAt: 'desc' },
          take: 4,
          include: {
            paidBy: { select: { id: true, name: true } },
          },
        },
        activities: {
          where: {
            date: {
              gte: this.startOfDay(new Date()),
              lte: this.endOfDay(new Date()),
            },
          },
          orderBy: { startTime: 'asc' },
        },
        _count: {
          select: {
            expenses: true,
            activities: true,
            reservations: true,
          },
        },
      },
    });

    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const allExpenses = await this.prisma.expense.findMany({
      where: { tripId },
      select: { amount: true },
    });

    const totalSpent = allExpenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0,
    );

    const completedActivityCount = await this.prisma.roadmapActivity.count({
      where: { tripId, status: 'COMPLETED' },
    });

    const allReservationsConfirmed =
      (await this.prisma.reservation.count({
        where: { tripId, status: { not: 'CONFIRMED' } },
      })) === 0;

    const participantsWithBalance =
      await this.calculateParticipantBalances(tripId);

    const newTripStatus = {
      hasInvitedParticipants: trip.participants.length > 1,
      hasRoadmapActivities: trip._count.activities > 0,
      hasExpenses: trip._count.expenses > 0,
    };

    return {
      trip: {
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        status: trip.status,
        participantCount: trip.participants.length,
      },
      totalSpent,
      budget: trip.budget ? Number(trip.budget) : 0,
      expenseCount: trip._count.expenses,
      activityCount: trip._count.activities,
      completedActivityCount,
      reservationCount: trip._count.reservations,
      allReservationsConfirmed,
      recentExpenses: trip.expenses.map((e) => ({
        id: e.id,
        description: e.description,
        category: e.category,
        paidByName: e.paidBy.name,
        paidByParticipantId: e.paidById,
        amount: Number(e.amount),
        date: e.date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }),
      })),
      todayLabel: new Date().toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }),
      todayActivities: trip.activities.map((a) => ({
        id: a.id,
        time: a.startTime,
        title: a.title,
        location: a.location ?? '',
        status: a.status.toLowerCase(),
      })),
      participants: participantsWithBalance,
      newTripStatus,
    };
  }

  // ─── Atualizar viagem ─────────────────────────────────────────────────────

  async update(userId: string, tripId: string, dto: UpdateTripDto) {
    await this.assertOrganizer(userId, tripId);

    return this.prisma.trip.update({
      where: { id: tripId },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        budget: dto.budget,
      },
    });
  }

  // ─── Deletar viagem ───────────────────────────────────────────────────────

  async remove(userId: string, tripId: string) {
    await this.assertOrganizer(userId, tripId);

    await this.prisma.trip.delete({ where: { id: tripId } });
    return { message: 'Viagem removida com sucesso' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async assertParticipant(userId: string, tripId: string) {
    const participation = await this.prisma.tripParticipant.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!participation) throw new ForbiddenException('Acesso negado');
    return participation;
  }

  async assertOrganizer(userId: string, tripId: string) {
    const participation = await this.assertParticipant(userId, tripId);
    if (participation.role !== 'ORGANIZER') {
      throw new ForbiddenException(
        'Apenas o organizador pode realizar esta ação',
      );
    }
    return participation;
  }

  private startOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private async calculateParticipantBalances(tripId: string) {
    const participants = await this.prisma.tripParticipant.findMany({
      where: { tripId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const balances = await this.balanceCalc.calculateBalances(
      tripId,
      participants.map((p) => ({ id: p.id, userId: p.userId })),
    );

    return participants.map((participant) => ({
      id: participant.user.id,
      name: participant.user.name,
      balance: balances.get(participant.id)!.balance,
    }));
  }
}
