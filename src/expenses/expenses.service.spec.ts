import { ForbiddenException } from '@nestjs/common';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  const createService = () => {
    const prisma = {
      tripParticipant: {
        findFirst: jest.fn(),
      },
      payment: {
        create: jest.fn(),
      },
    };
    const tripsService = {};
    const balanceCalc = {};

    return {
      prisma,
      service: new ExpensesService(
        prisma as any,
        tripsService as any,
        balanceCalc as any,
      ),
    };
  };

  it('registra pagamento convertendo userIds para participantes da viagem', async () => {
    const { prisma, service } = createService();
    prisma.tripParticipant.findFirst
      .mockResolvedValueOnce({ id: 'from-participant', userId: 'user-b' })
      .mockResolvedValueOnce({ id: 'to-participant', userId: 'user-a' });
    prisma.payment.create.mockResolvedValue({ id: 'payment-1' });

    await expect(
      service.createPayment('trip-1', 'user-b', {
        fromUserId: 'user-b',
        toUserId: 'user-a',
        amount: 30,
      }),
    ).resolves.toEqual({ id: 'payment-1' });

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        tripId: 'trip-1',
        fromParticipantId: 'from-participant',
        toParticipantId: 'to-participant',
        amount: 30,
        createdBy: 'user-b',
        notes: undefined,
      },
    });
  });

  it('impede que outro usuário marque pagamento em nome do devedor', async () => {
    const { prisma, service } = createService();
    prisma.tripParticipant.findFirst
      .mockResolvedValueOnce({ id: 'from-participant', userId: 'user-b' })
      .mockResolvedValueOnce({ id: 'to-participant', userId: 'user-a' });

    await expect(
      service.createPayment('trip-1', 'user-a', {
        fromUserId: 'user-b',
        toUserId: 'user-a',
        amount: 30,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
