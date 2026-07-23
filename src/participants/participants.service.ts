import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TripsService } from '../trips/trips.service';
import { InviteByEmailDto } from './dto/invite-by-email.dto';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { BalanceCalculatorService } from '../finances/balance.service';

type ParticipantForBalance = {
  id: string;
  userId: string;
  sponsorId: string | null;
  role?: string;
  joinedAt?: Date;
  user: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string | null;
  };
};

@Injectable()
export class ParticipantsService {
  constructor(
    private prisma: PrismaService,
    private tripsService: TripsService,
    private config: ConfigService,
    private email: EmailService,
    private readonly balanceCalc: BalanceCalculatorService,
  ) { }

  /** Monta o link de convite usando a URL do frontend configurada por ambiente */
  private buildInviteLink(inviteToken: string | undefined): string {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    return `${frontendUrl}/join/${inviteToken}`;
  }

  // ─── Listar participantes ─────────────────────────────────────────────────

  async findAll(userId: string, tripId: string) {
    await this.tripsService.assertParticipant(userId, tripId);

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { name: true, startDate: true, endDate: true, budget: true },
    });

    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const participants = await this.prisma.tripParticipant.findMany({
      where: { tripId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    const participantsWithBalance = await this.calculateParticipantBalances(
      tripId,
      participants,
    );

    const totalSpent = participantsWithBalance.reduce(
      (sum, p) => sum + p.totalPaid,
      0,
    );

    const pendingSettlements = this.calculateSettlements(
      participantsWithBalance,
    );

    const tripData = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { inviteToken: true },
    });

    return {
      tripName: trip.name,
      tripPeriod: this.formatPeriod(trip.startDate, trip.endDate),
      participantCount: participants.length,
      maxParticipants: 10,
      organizerCount: participants.filter((p) => p.role === 'ORGANIZER').length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      perPersonAverage:
        participants.length > 0
          ? Math.round((totalSpent / participants.length) * 100) / 100
          : 0,
      pendingSettlementsCount: pendingSettlements.length,
      pendingSettlementsAmount:
        Math.round(
          pendingSettlements.reduce((sum, s) => sum + s.amount, 0) * 100,
        ) / 100,
      groupStatusLabel: 'Ativo',
      groupStatusSublabel: 'todos confirmados',
      inviteLink: this.buildInviteLink(tripData?.inviteToken),
      participants: participantsWithBalance,
      settlementSummary: pendingSettlements,
    };
  }

  // ─── Convidar via e-mail ──────────────────────────────────────────────────

  async inviteByEmail(userId: string, tripId: string, dto: InviteByEmailDto) {
    await this.tripsService.assertParticipant(userId, tripId);

    // Dados usados no corpo do e-mail de convite
    const [trip, inviter] = await Promise.all([
      this.prisma.trip.findUnique({
        where: { id: tripId },
        select: { name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
    ]);

    const tripName = trip?.name ?? 'uma viagem';
    const inviterName = inviter?.name ?? 'Um amigo';

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invites = await Promise.all(
      dto.emails.map(async (email) => {
        // Verifica se já existe participante com esse e-mail
        const existingUser = await this.prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          const alreadyParticipant =
            await this.prisma.tripParticipant.findUnique({
              where: {
                tripId_userId: { tripId, userId: existingUser.id },
              },
            });
          if (alreadyParticipant) return null;
        }

        // Cria o convite
        const invite = await this.prisma.invite.create({
          data: { tripId, invitedBy: userId, email, expiresAt },
        });

        // Envia o e-mail de convite (não bloqueia em caso de falha)
        await this.email.sendInvite({
          to: email,
          tripName,
          inviterName,
          inviteToken: invite.token,
        });

        return invite;
      }),
    );

    const sent = invites.filter(Boolean).length;

    return {
      message: `${sent} convite(s) enviado(s) com sucesso`,
      invites: invites.filter(Boolean),
    };
  }

  // ─── Buscar link de convite ───────────────────────────────────────────────

  async getInviteLink(userId: string, tripId: string) {
    await this.tripsService.assertParticipant(userId, tripId);

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { inviteToken: true, name: true },
    });

    if (!trip) throw new NotFoundException('Viagem não encontrada');

    return {
      inviteLink: this.buildInviteLink(trip.inviteToken),
      inviteToken: trip.inviteToken,
    };
  }

  // ─── Entrar via token ─────────────────────────────────────────────────────

  async joinByToken(userId: string, token: string) {
    // Resolve a viagem a partir do token (link direto OU convite por e-mail)
    let tripId: string | null = null;
    let inviteId: string | null = null;

    const tripByToken = await this.prisma.trip.findUnique({
      where: { inviteToken: token },
    });

    if (tripByToken) {
      tripId = tripByToken.id;
    } else {
      const invite = await this.prisma.invite.findUnique({
        where: { token },
      });

      if (!invite) throw new NotFoundException('Token de convite inválido');
      if (invite.expiresAt < new Date()) {
        throw new BadRequestException('Convite expirado');
      }
      if (invite.status !== 'PENDING') {
        throw new BadRequestException('Convite já utilizado');
      }
      tripId = invite.tripId;
      inviteId = invite.id;
    }

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, name: true },
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    // Idempotente: se já for participante, apenas retorna a viagem (sem erro)
    const existing = await this.prisma.tripParticipant.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });

    if (!existing) {
      await this.prisma.tripParticipant.create({
        data: { tripId, userId, role: 'MEMBER' },
      });

      // Marca o convite por e-mail como aceito, quando aplicável
      if (inviteId) {
        await this.prisma.invite.update({
          where: { id: inviteId },
          data: { status: 'ACCEPTED' },
        });
      }
    }

    return {
      tripId: trip.id,
      tripName: trip.name,
      alreadyMember: !!existing,
    };
  }

  // ─── Remover participante ─────────────────────────────────────────────────

  async remove(userId: string, tripId: string, participantId: string) {
    await this.tripsService.assertOrganizer(userId, tripId);

    // Não permite remover o próprio organizador
    if (participantId === userId) {
      throw new BadRequestException(
        'O organizador não pode remover a si mesmo',
      );
    }

    const participant = await this.prisma.tripParticipant.findUnique({
      where: { tripId_userId: { tripId, userId: participantId } },
    });

    if (!participant)
      throw new NotFoundException('Participante não encontrado');

    await this.prisma.tripParticipant.delete({
      where: { tripId_userId: { tripId, userId: participantId } },
    });

    return { message: 'Participante removido com sucesso' };
  }

  // ─── Vincular/desvincular dependente ──────────────────────────────────────

  async setSponsor(
    userId: string,
    tripId: string,
    participantId: string,
    sponsorId: string | null,
  ) {
    await this.tripsService.assertParticipant(userId, tripId);

    const actor = await this.prisma.tripParticipant.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!actor) throw new ForbiddenException('Acesso negado');

    const target = await this.prisma.tripParticipant.findUnique({
      where: { tripId_userId: { tripId, userId: participantId } },
    });
    if (!target) throw new NotFoundException('Participante não encontrado');

    if (sponsorId === null) {
      if (target.sponsorId === null) {
        return { message: 'Participante já é independente' };
      }

      const canUnlink =
        actor.role === 'ORGANIZER' || actor.id === target.sponsorId;
      if (!canUnlink) {
        throw new ForbiddenException(
          'Apenas o patrocinador ou o organizador podem remover este vínculo',
        );
      }

      await this.prisma.tripParticipant.update({
        where: { id: target.id },
        data: { sponsorId: null },
      });
      return { message: 'Vínculo de dependente removido' };
    }

    if (sponsorId === participantId) {
      throw new BadRequestException(
        'Um participante não pode ser seu próprio patrocinador',
      );
    }

    const sponsor = await this.prisma.tripParticipant.findUnique({
      where: { tripId_userId: { tripId, userId: sponsorId } },
    });
    if (!sponsor) {
      throw new BadRequestException(
        'Patrocinador precisa ser um participante desta viagem',
      );
    }

    if (sponsor.sponsorId !== null) {
      throw new BadRequestException(
        'Um dependente não pode patrocinar outro participante',
      );
    }

    const dependentsOfTarget = await this.prisma.tripParticipant.count({
      where: { sponsorId: target.id },
    });
    if (dependentsOfTarget > 0) {
      throw new BadRequestException(
        'Este participante já é patrocinador de outros e não pode se tornar dependente',
      );
    }

    const canLink = actor.role === 'ORGANIZER' || actor.id === sponsor.id;
    if (!canLink) {
      throw new ForbiddenException(
        'Apenas o próprio patrocinador ou o organizador podem criar este vínculo',
      );
    }

    await this.prisma.tripParticipant.update({
      where: { id: target.id },
      data: { sponsorId: sponsor.id },
    });
    return { message: 'Dependente vinculado com sucesso' };
  }

  // ─── Acertos ──────────────────────────────────────────────────────────────
  async getSettlements(userId: string, tripId: string) {
    await this.tripsService.assertParticipant(userId, tripId);

    const participants = await this.prisma.tripParticipant.findMany({
      where: { tripId },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    const withBalance = await this.calculateParticipantBalances(
      tripId,
      participants,
    );

    const totalShared = withBalance.reduce(
      (sum, p) => sum + p.individualQuota,
      0,
    );

    return {
      perPersonAverage:
        participants.length > 0
          ? Math.round((totalShared / participants.length) * 100) / 100
          : 0,
      settlements: this.calculateSettlements(withBalance),
    };
  }

  // ─── Notificar devedores ──────────────────────────────────────────────────

  async notifyDebtors(userId: string, tripId: string) {
    await this.tripsService.assertParticipant(userId, tripId);

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { name: true },
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    // Reúne participantes com saldo (paga - deve) e um mapa id → e-mail
    const participants = await this.prisma.tripParticipant.findMany({
      where: { tripId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const emailByParticipantUserId = new Map(
      participants.map((participant) => [
        participant.user.id,
        participant.user.email,
      ]),
    );
    const withBalance = await this.calculateParticipantBalances(
      tripId,
      participants,
    );

    const settlements = this.calculateSettlements(withBalance);

    // Envia um e-mail para cada devedor (from = quem deve)
    const currencyFmt = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const results = await Promise.all(
      settlements.map((s) => {
        const to = emailByParticipantUserId.get(s.fromParticipantId);
        if (!to) return Promise.resolve(false);
        return this.email.sendDebtorNotification({
          to,
          debtorName: s.fromName,
          tripName: trip.name,
          amount: currencyFmt.format(s.amount),
          toName: s.toName,
        });
      }),
    );

    const notified = results.filter(Boolean).length;

    return {
      message:
        notified > 0
          ? `${notified} devedor(es) notificado(s) por e-mail`
          : 'Nenhum devedor pendente para notificar',
      notified,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private async calculateParticipantBalances(
    tripId: string,
    participants: ParticipantForBalance[],
  ) {
    const balances = await this.balanceCalc.calculateBalances(
      tripId,
      participants.map((p) => ({ id: p.id, userId: p.userId })),
    );
    const byTripParticipantId = new Map(
      participants.map((p) => [p.id, p]),
    );

    return participants.map((participant) => {
      const b = balances.get(participant.id)!;
      const sponsor = participant.sponsorId
        ? byTripParticipantId.get(participant.sponsorId)
        : undefined;
      return {
        id: participant.user.id,
        name: participant.user.name,
        email: participant.user.email,
        avatarUrl: participant.user.avatarUrl,
        role: participant.role,
        totalPaid: b.totalPaid,
        individualQuota: b.individualQuota,
        balance: b.balance,
        joinedAt: participant.joinedAt,
        sponsorId: sponsor ? sponsor.user.id : null,
        sponsorName: sponsor ? sponsor.user.name : null,
      };
    });
  }

  private async addParticipant(userId: string, tripId: string) {
    const existing = await this.prisma.tripParticipant.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });

    if (existing)
      throw new ConflictException('Você já é participante desta viagem');

    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    return this.prisma.tripParticipant.create({
      data: { tripId, userId, role: 'MEMBER' },
      include: {
        trip: { select: { id: true, name: true, destination: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // Algoritmo de liquidação mínima de débitos
  // Garante o menor número de transações pra quitar todos os saldos
  private calculateSettlements(
    participants: { id: string; name: string; balance: number }[],
  ) {
    const debtors = participants
      .filter((p) => p.balance < 0)
      .map((p) => ({ ...p, balance: Math.abs(p.balance) }))
      .sort((a, b) => b.balance - a.balance);

    const creditors = participants
      .filter((p) => p.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    const settlements: {
      id: string;
      fromParticipantId: string;
      fromName: string;
      toParticipantId: string;
      toName: string;
      amount: number;
      description: string;
    }[] = [];

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(debtor.balance, creditor.balance);

      if (amount > 0.01) {
        settlements.push({
          id: `${debtor.id}-${creditor.id}`,
          fromParticipantId: debtor.id,
          fromName: debtor.name,
          toParticipantId: creditor.id,
          toName: creditor.name,
          amount: Math.round(amount * 100) / 100,
          description: '',
        });
      }

      debtor.balance -= amount;
      creditor.balance -= amount;

      if (debtor.balance < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }

    return settlements;
  }

  private formatPeriod(start: Date, end: Date): string {
    const month = end
      .toLocaleDateString('pt-BR', { month: 'short' })
      .replace('.', '');
    return `${start.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')} ${start.getFullYear()}`;
  }
}
