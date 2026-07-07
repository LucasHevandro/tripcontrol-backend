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

@Injectable()
export class ParticipantsService {
    constructor(
        private prisma: PrismaService,
        private tripsService: TripsService,
    ) { }

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

        // Para cada participante: quanto pagou e quanto deve (via splits)
        const participantsWithBalance = await Promise.all(
            participants.map(async (p) => {
                // Total que esse participante pagou (como payer)
                const paidExpenses = await this.prisma.expense.findMany({
                    where: { tripId, paidById: p.userId },
                    select: { amount: true },
                });
                const totalPaid = paidExpenses.reduce(
                    (sum, e) => sum + Number(e.amount),
                    0,
                );

                // Total que esse participante deve (via expense_splits)
                const splits = await this.prisma.expenseSplit.findMany({
                    where: { participantId: p.id },
                    select: { amount: true },
                });
                const totalOwed = splits.reduce(
                    (sum, s) => sum + Number(s.amount),
                    0,
                );

                const balance = Math.round((totalPaid - totalOwed) * 100) / 100;

                return {
                    id: p.user.id,
                    name: p.user.name,
                    email: p.user.email,
                    avatarUrl: p.user.avatarUrl,
                    role: p.role,
                    totalPaid: Math.round(totalPaid * 100) / 100,
                    individualQuota: Math.round(totalOwed * 100) / 100,
                    balance,
                    joinedAt: p.joinedAt,
                };
            }),
        );

        const totalSpent = participantsWithBalance.reduce(
            (sum, p) => sum + p.totalPaid,
            0,
        );

        const pendingSettlements = this.calculateSettlements(participantsWithBalance);

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
            pendingSettlementsAmount: Math.round(
                pendingSettlements.reduce((sum, s) => sum + s.amount, 0) * 100,
            ) / 100,
            groupStatusLabel: 'Ativo',
            groupStatusSublabel: 'todos confirmados',
            inviteLink: `tripcontrol.app/join/${tripData?.inviteToken}`,
            participants: participantsWithBalance,
            settlementSummary: pendingSettlements,
        };
    }

    // ─── Convidar via e-mail ──────────────────────────────────────────────────

    async inviteByEmail(userId: string, tripId: string, dto: InviteByEmailDto) {
        await this.tripsService.assertParticipant(userId, tripId);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const invites = await Promise.all(
            dto.emails.map(async (email) => {
                // Verifica se já existe participante com esse e-mail
                const existingUser = await this.prisma.user.findUnique({
                    where: { email },
                });

                if (existingUser) {
                    const alreadyParticipant = await this.prisma.tripParticipant.findUnique({
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

                // TODO: enviar e-mail real com o link de convite
                // await this.emailService.sendInvite(email, invite.token, tripName);
                console.log(
                    `📧 Convite enviado para ${email}: /join/${invite.token}`,
                );

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
            inviteLink: `tripcontrol.app/join/${trip.inviteToken}`,
            inviteToken: trip.inviteToken,
        };
    }

    // ─── Entrar via token ─────────────────────────────────────────────────────

    async joinByToken(userId: string, token: string) {
        // Tenta via link direto da viagem (inviteToken)
        const tripByToken = await this.prisma.trip.findUnique({
            where: { inviteToken: token },
        });

        if (tripByToken) {
            return this.addParticipant(userId, tripByToken.id);
        }

        // Tenta via convite por e-mail
        const invite = await this.prisma.invite.findUnique({
            where: { token },
            include: { trip: true },
        });

        if (!invite) throw new NotFoundException('Token de convite inválido');
        if (invite.expiresAt < new Date()) {
            throw new BadRequestException('Convite expirado');
        }
        if (invite.status !== 'PENDING') {
            throw new BadRequestException('Convite já utilizado');
        }

        const participant = await this.addParticipant(userId, invite.tripId);

        // Marca convite como aceito
        await this.prisma.invite.update({
            where: { id: invite.id },
            data: { status: 'ACCEPTED' },
        });

        return participant;
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

        if (!participant) throw new NotFoundException('Participante não encontrado');

        await this.prisma.tripParticipant.delete({
            where: { tripId_userId: { tripId, userId: participantId } },
        });

        return { message: 'Participante removido com sucesso' };
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

        const withBalance = await Promise.all(
            participants.map(async (p) => {
                const paidExpenses = await this.prisma.expense.findMany({
                    where: { tripId, paidById: p.userId },
                    select: { amount: true },
                });
                const totalPaid = paidExpenses.reduce(
                    (sum, e) => sum + Number(e.amount),
                    0,
                );

                const splits = await this.prisma.expenseSplit.findMany({
                    where: { participantId: p.id },
                    select: { amount: true },
                });
                const totalOwed = splits.reduce(
                    (sum, s) => sum + Number(s.amount),
                    0,
                );

                return {
                    id: p.user.id,
                    name: p.user.name,
                    balance: Math.round((totalPaid - totalOwed) * 100) / 100,
                };
            }),
        );

        const totalSpent = withBalance.reduce(
            (sum, p) => sum + (p.balance > 0 ? p.balance : 0),
            0,
        );

        return {
            perPersonAverage:
                participants.length > 0
                    ? Math.round((totalSpent / participants.length) * 100) / 100
                    : 0,
            settlements: this.calculateSettlements(withBalance),
        };
    }

    // ─── Notificar devedores ──────────────────────────────────────────────────

    async notifyDebtors(userId: string, tripId: string) {
        await this.tripsService.assertParticipant(userId, tripId);

        // TODO: enviar e-mail/push real para cada devedor
        console.log(`📢 Notificando devedores da viagem ${tripId}`);

        return { message: 'Devedores notificados com sucesso' };
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private async addParticipant(userId: string, tripId: string) {
        const existing = await this.prisma.tripParticipant.findUnique({
            where: { tripId_userId: { tripId, userId } },
        });

        if (existing) throw new ConflictException('Você já é participante desta viagem');

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
        const month = end.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        return `${start.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')} ${start.getFullYear()}`;
    }
}