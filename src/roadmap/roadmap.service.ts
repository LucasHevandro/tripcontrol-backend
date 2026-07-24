import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TripsService } from '../trips/trips.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityStatus, CostType } from '../generated/prisma/enums';
import type { RoadmapActivityModel } from '../generated/prisma/models';

@Injectable()
export class RoadmapService {
  constructor(
    private prisma: PrismaService,
    private tripsService: TripsService,
  ) {}

  // ─── Listar roteiro completo ───────────────────────────────────────────────

  async findAll(userId: string, tripId: string) {
    await this.tripsService.assertParticipant(userId, tripId);

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        name: true,
        destination: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const activities = await this.prisma.roadmapActivity.findMany({
      where: { tripId },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const participantCount = await this.prisma.tripParticipant.count({
      where: { tripId },
    });

    const days = this.buildDays(
      trip.startDate,
      trip.endDate,
      activities,
      participantCount,
    );

    const reservations = await this.prisma.reservation.findMany({
      where: { tripId, status: 'CONFIRMED' },
      select: {
        id: true,
        title: true,
        subtitle: true,
        category: true,
        status: true,
      },
      take: 5,
    });

    const durationDays =
      Math.round(
        (trip.endDate.getTime() - trip.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;

    return {
      tripName: trip.destination,
      tripPeriod: this.formatPeriod(trip.startDate, trip.endDate),
      tripDurationDays: durationDays,
      days,
      activeReservations: reservations.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle ?? '',
        status: r.status.toLowerCase(),
        icon: this.mapReservationIcon(r.category),
      })),
    };
  }

  // ─── Criar atividade ──────────────────────────────────────────────────────

  async create(userId: string, tripId: string, dto: CreateActivityDto) {
    await this.tripsService.assertParticipant(userId, tripId);

    const activity = await this.prisma.roadmapActivity.create({
      data: {
        tripId,
        emoji: dto.emoji,
        title: dto.title,
        date: new Date(dto.date),
        startTime: dto.startTime,
        duration: dto.duration,
        location: dto.location,
        costAmount: dto.costAmount,
        costType: dto.costType ?? CostType.FREE,
        note: dto.note,
        status: dto.status ?? ActivityStatus.UPCOMING,
      },
    });

    return this.formatActivity(activity);
  }

  // ─── Atualizar atividade ──────────────────────────────────────────────────

  async update(
    userId: string,
    tripId: string,
    activityId: string,
    dto: UpdateActivityDto,
  ) {
    await this.tripsService.assertParticipant(userId, tripId);
    await this.assertActivityBelongsToTrip(activityId, tripId);

    const activity = await this.prisma.roadmapActivity.update({
      where: { id: activityId },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });

    return this.formatActivity(activity);
  }

  // ─── Atualizar status ─────────────────────────────────────────────────────

  async updateStatus(
    userId: string,
    tripId: string,
    activityId: string,
    status: ActivityStatus,
  ) {
    await this.tripsService.assertParticipant(userId, tripId);
    await this.assertActivityBelongsToTrip(activityId, tripId);

    const activity = await this.prisma.roadmapActivity.update({
      where: { id: activityId },
      data: { status },
    });

    return this.formatActivity(activity);
  }

  // ─── Deletar atividade ────────────────────────────────────────────────────

  async remove(userId: string, tripId: string, activityId: string) {
    await this.tripsService.assertParticipant(userId, tripId);
    await this.assertActivityBelongsToTrip(activityId, tripId);

    await this.prisma.roadmapActivity.delete({ where: { id: activityId } });
    return { message: 'Atividade removida com sucesso' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async assertActivityBelongsToTrip(
    activityId: string,
    tripId: string,
  ) {
    const activity = await this.prisma.roadmapActivity.findUnique({
      where: { id: activityId },
    });

    if (!activity || activity.tripId !== tripId) {
      throw new NotFoundException('Atividade não encontrada');
    }

    return activity;
  }

  private buildDays(
    startDate: Date,
    endDate: Date,
    activities: RoadmapActivityModel[],
    participantCount: number,
  ) {
    const days: {
      date: string;
      label: string;
      shortLabel: string;
      fullLabel: string;
      activityCount: number;
      participantCount: number;
      activities: ReturnType<typeof this.formatActivity>[];
    }[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];

      const dayActivities = activities.filter((a) => {
        const actDate = new Date(a.date).toISOString().split('T')[0];
        return actDate === dateStr;
      });

      const weekday = current.toLocaleDateString('pt-BR', { weekday: 'short' });
      const day = current.getDate().toString().padStart(2, '0');
      const month = (current.getMonth() + 1).toString().padStart(2, '0');

      days.push({
        date: dateStr,
        label: `${this.capitalizeFirst(weekday)} ${day}/${month}`,
        shortLabel: `${this.capitalizeFirst(weekday)} ${day}/${month}`,
        fullLabel: current.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        activityCount: dayActivities.length,
        participantCount,
        activities: dayActivities.map((a) => this.formatActivity(a)),
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  private formatActivity(a: RoadmapActivityModel) {
    const costLabel = this.buildCostLabel(
      a.costType,
      a.costAmount ? Number(a.costAmount) : null,
    );

    return {
      id: a.id,
      time: a.startTime,
      emoji: a.emoji,
      title: a.title,
      duration: a.duration ?? '',
      location: a.location ?? '',
      costLabel,
      note: a.note ?? '',
      status: a.status.toLowerCase(),
      badge: this.buildBadge(a.status),
      // Campos crus — usados pelo formulário de edição no frontend
      date:
        a.date instanceof Date ? a.date.toISOString().split('T')[0] : a.date,
      startTime: a.startTime,
      costAmount: a.costAmount ? Number(a.costAmount) : null,
      costType: a.costType,
    };
  }

  private buildCostLabel(costType: CostType, amount: number | null): string {
    if (costType === CostType.FREE || !amount) return 'R$ 0';
    if (costType === CostType.PER_PERSON) return `~R$ ${amount}/pessoa`;
    return `R$ ${amount} total`;
  }

  private buildBadge(status: ActivityStatus): string | undefined {
    if (status === ActivityStatus.COMPLETED) return 'Concluído';
    if (status === ActivityStatus.CURRENT) return 'Agora';
    return undefined;
  }

  private mapReservationIcon(
    category: string,
  ): 'hotel' | 'car' | 'flight' | 'boat' {
    const map: Record<string, 'hotel' | 'car' | 'flight' | 'boat'> = {
      HOTEL: 'hotel',
      CAR: 'car',
      FLIGHT: 'flight',
      TOUR: 'boat',
    };
    return map[category] ?? 'hotel';
  }

  private formatPeriod(start: Date, end: Date): string {
    const startDay = start.getDate();
    const endDay = end.getDate();
    const month = end
      .toLocaleDateString('pt-BR', { month: 'short' })
      .replace('.', '');
    const year = end.getFullYear();
    return `${startDay}–${endDay} ${month} ${year}`;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).replace('.', '');
  }
}
