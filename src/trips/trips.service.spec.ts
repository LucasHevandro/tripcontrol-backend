jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { TripsService } from './trips.service';
import { TripStatus } from '../generated/prisma/enums';

describe('TripsService', () => {
  it('cria viagem com o usuário autenticado como organizador', async () => {
    const prisma = {
      trip: {
        create: jest.fn().mockResolvedValue({ id: 'trip-1' }),
      },
    };
    const service = new TripsService(prisma as any);

    await expect(
      service.create('user-1', {
        name: 'Serra Gaúcha',
        destination: 'Rio Grande do Sul',
        startDate: '2026-03-14',
        endDate: '2026-03-18',
      }),
    ).resolves.toEqual({ id: 'trip-1' });

    expect(prisma.trip.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Serra Gaúcha',
        destination: 'Rio Grande do Sul',
        status: TripStatus.PLANNING,
        participants: {
          create: {
            userId: 'user-1',
            role: 'ORGANIZER',
          },
        },
      }),
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  });
});
