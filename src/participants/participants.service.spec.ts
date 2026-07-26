jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ParticipantsService } from './participants.service';
import { BalanceCalculatorService } from '../finances/balance.service';

describe('ParticipantsService', () => {
  const createService = () => {
    const prisma = {
      tripParticipant: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      expense: {
        findMany: jest.fn(),
      },
      expenseSplit: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
      },
    };
    const tripsService = {
      assertParticipant: jest.fn().mockResolvedValue({ id: 'participant-a' }),
      assertOrganizer: jest.fn().mockResolvedValue({ id: 'participant-a' }),
    };
    // Serviço real de cálculo de saldos, rodando sobre o mesmo prisma mockado —
    // exercita a lógica real de agregação, não apenas um stub.
    const balanceCalc = new BalanceCalculatorService(prisma as any);

    return {
      prisma,
      tripsService,
      balanceCalc,
      service: new ParticipantsService(
        prisma as any,
        tripsService as any,
        {} as any,
        {} as any,
        balanceCalc,
      ),
    };
  };

  it('calcula acertos descontando pagamentos já registrados', async () => {
    const { prisma, service } = createService();
    prisma.tripParticipant.findMany.mockResolvedValue([
      {
        id: 'participant-a',
        userId: 'user-a',
        user: { id: 'user-a', name: 'Ana' },
      },
      {
        id: 'participant-b',
        userId: 'user-b',
        user: { id: 'user-b', name: 'Bruno' },
      },
    ]);
    prisma.expense.findMany.mockResolvedValue([
      { paidById: 'user-a', amount: 100 },
    ]);
    prisma.expenseSplit.findMany.mockResolvedValue([
      { participantId: 'participant-a', amount: 50 },
      { participantId: 'participant-b', amount: 50 },
    ]);
    prisma.payment.findMany.mockResolvedValue([
      {
        fromParticipantId: 'participant-b',
        toParticipantId: 'participant-a',
        amount: 20,
      },
    ]);

    await expect(service.getSettlements('user-a', 'trip-1')).resolves.toEqual({
      perPersonAverage: 50,
      settlements: [
        {
          id: 'user-b-user-a',
          fromParticipantId: 'user-b',
          fromName: 'Bruno',
          toParticipantId: 'user-a',
          toName: 'Ana',
          amount: 30,
          description: '',
        },
      ],
    });

    expect(prisma.expense.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.expenseSplit.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.payment.findMany).toHaveBeenCalledTimes(1);
  });

  describe('remove', () => {
    it('bloqueia remover participante que já tem despesas registradas', async () => {
      const { prisma, service } = createService();
      prisma.tripParticipant.findUnique.mockResolvedValue({
        id: 'participant-b',
      });
      prisma.expenseSplit.count.mockResolvedValue(2);

      await expect(
        service.remove('user-a', 'trip-1', 'user-b'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.tripParticipant.delete).not.toHaveBeenCalled();
    });

    it('remove normalmente um participante sem despesas', async () => {
      const { prisma, service } = createService();
      prisma.tripParticipant.findUnique.mockResolvedValue({
        id: 'participant-b',
      });
      prisma.expenseSplit.count.mockResolvedValue(0);
      prisma.tripParticipant.delete.mockResolvedValue(undefined);

      await expect(
        service.remove('user-a', 'trip-1', 'user-b'),
      ).resolves.toEqual({ message: 'Participante removido com sucesso' });

      expect(prisma.tripParticipant.delete).toHaveBeenCalledWith({
        where: { tripId_userId: { tripId: 'trip-1', userId: 'user-b' } },
      });
    });
  });

  describe('setSponsor', () => {
    const TRIP = 'trip-1';
    const OTHER_TRIP = 'trip-2';

    // Ana: organizadora, Bruno: membro comum, Bruno-esposa: dependente de Bruno,
    // Carlos: já patrocina alguém em outra viagem (para o teste de trip cruzado).
    const baseRows = [
      {
        id: 'p-ana',
        tripId: TRIP,
        userId: 'user-ana',
        role: 'ORGANIZER',
        sponsorId: null,
      },
      {
        id: 'p-bruno',
        tripId: TRIP,
        userId: 'user-bruno',
        role: 'MEMBER',
        sponsorId: null,
      },
      {
        id: 'p-bruno-esposa',
        tripId: TRIP,
        userId: 'user-bruno-esposa',
        role: 'MEMBER',
        sponsorId: 'p-bruno',
      },
      {
        id: 'p-carlos',
        tripId: TRIP,
        userId: 'user-carlos',
        role: 'MEMBER',
        sponsorId: null,
      },
      {
        id: 'p-outro',
        tripId: OTHER_TRIP,
        userId: 'user-outro',
        role: 'MEMBER',
        sponsorId: null,
      },
    ];

    const mockRows = (
      prisma: ReturnType<typeof createService>['prisma'],
      rows = baseRows,
    ) => {
      prisma.tripParticipant.findUnique.mockImplementation(
        (args: {
          where: { tripId_userId: { tripId: string; userId: string } };
        }) =>
          Promise.resolve(
            rows.find(
              (r) =>
                r.tripId === args.where.tripId_userId.tripId &&
                r.userId === args.where.tripId_userId.userId,
            ) ?? null,
          ),
      );
      prisma.tripParticipant.count.mockImplementation(
        (args: { where: { sponsorId: string } }) =>
          Promise.resolve(
            rows.filter((r) => r.sponsorId === args.where.sponsorId).length,
          ),
      );
      prisma.tripParticipant.update.mockResolvedValue(undefined);
    };

    it('vincula um dependente ao patrocinador que está agindo', async () => {
      const { prisma, service } = createService();
      mockRows(prisma);

      await service.setSponsor('user-bruno', TRIP, 'user-carlos', 'user-bruno');

      expect(prisma.tripParticipant.update).toHaveBeenCalledWith({
        where: { id: 'p-carlos' },
        data: { sponsorId: 'p-bruno' },
      });
    });

    it('organizador pode vincular dois outros participantes', async () => {
      const { prisma, service } = createService();
      mockRows(prisma);

      await service.setSponsor('user-ana', TRIP, 'user-carlos', 'user-bruno');

      expect(prisma.tripParticipant.update).toHaveBeenCalledWith({
        where: { id: 'p-carlos' },
        data: { sponsorId: 'p-bruno' },
      });
    });

    it('rejeita auto-patrocínio', async () => {
      const { prisma, service } = createService();
      mockRows(prisma);

      await expect(
        service.setSponsor('user-bruno', TRIP, 'user-bruno', 'user-bruno'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita corrente: quem já é dependente não pode virar patrocinador', async () => {
      const { prisma, service } = createService();
      mockRows(prisma);

      await expect(
        service.setSponsor(
          'user-bruno-esposa',
          TRIP,
          'user-carlos',
          'user-bruno-esposa',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita corrente reversa: quem já patrocina não pode virar dependente', async () => {
      const { prisma, service } = createService();
      mockRows(prisma);

      await expect(
        service.setSponsor('user-carlos', TRIP, 'user-bruno', 'user-carlos'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita patrocinador que não pertence à mesma viagem', async () => {
      const { prisma, service } = createService();
      mockRows(prisma);

      await expect(
        service.setSponsor('user-bruno', TRIP, 'user-carlos', 'user-outro'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita ator não autorizado (nem organizador, nem o patrocinador)', async () => {
      const { prisma, service } = createService();
      mockRows(prisma);

      await expect(
        service.setSponsor('user-carlos', TRIP, 'user-carlos', 'user-bruno'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('desvincula pelo próprio patrocinador', async () => {
      const { prisma, service } = createService();
      mockRows(prisma);

      await service.setSponsor('user-bruno', TRIP, 'user-bruno-esposa', null);

      expect(prisma.tripParticipant.update).toHaveBeenCalledWith({
        where: { id: 'p-bruno-esposa' },
        data: { sponsorId: null },
      });
    });

    it('desvincula pelo organizador', async () => {
      const { prisma, service } = createService();
      mockRows(prisma);

      await service.setSponsor('user-ana', TRIP, 'user-bruno-esposa', null);

      expect(prisma.tripParticipant.update).toHaveBeenCalledWith({
        where: { id: 'p-bruno-esposa' },
        data: { sponsorId: null },
      });
    });

    it('rejeita desvincular por quem não é organizador nem patrocinador', async () => {
      const { prisma, service } = createService();
      mockRows(prisma);

      await expect(
        service.setSponsor('user-carlos', TRIP, 'user-bruno-esposa', null),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
