jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { ParticipantsService } from './participants.service';

describe('ParticipantsService', () => {
  const createService = () => {
    const prisma = {
      tripParticipant: {
        findMany: jest.fn(),
      },
      expense: {
        findMany: jest.fn(),
      },
      expenseSplit: {
        findMany: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
      },
    };
    const tripsService = {
      assertParticipant: jest.fn().mockResolvedValue({ id: 'participant-a' }),
    };

    return {
      prisma,
      service: new ParticipantsService(
        prisma as any,
        tripsService as any,
        {} as any,
        {} as any,
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
});
