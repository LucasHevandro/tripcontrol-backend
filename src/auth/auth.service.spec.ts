import { createHash } from 'crypto';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { AuthService } from './auth.service';

describe('AuthService', () => {
  const createService = () => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        delete: jest.fn(),
      },
    };
    const jwt = {
      sign: jest.fn((_: unknown, options: { secret: string }) =>
        options.secret === 'refresh-secret-12345678901234567890'
          ? 'refresh-token'
          : 'access-token',
      ),
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          GOOGLE_CLIENT_ID: 'google-client',
          JWT_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return values[key] ?? fallback;
      }),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_SECRET: 'access-secret-123456789012345678901',
          JWT_REFRESH_SECRET: 'refresh-secret-12345678901234567890',
        };
        return values[key];
      }),
    };

    return {
      prisma,
      service: new AuthService(prisma as any, jwt as any, config as any),
    };
  };

  it('armazena hash do refresh token ao registrar usuário', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      name: 'Lia',
      email: 'lia@example.com',
      phone: null,
      createdAt: new Date('2026-01-01'),
    });

    await service.register({
      name: 'Lia',
      email: 'lia@example.com',
      password: 'Senha123!',
    });

    const expectedHash = createHash('sha256')
      .update('refresh-token')
      .digest('hex');
    // expect.any(...) e mock.calls são tipados como `any` nas próprias
    // definições do Jest — idiomático em teste, não um valor inseguro de verdade.
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: {
        token: expectedHash,
        userId: 'user-1',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expiresAt: expect.any(Date),
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(prisma.refreshToken.create.mock.calls[0][0].data.token).not.toBe(
      'refresh-token',
    );
  });

  it('remove refresh token usando hash durante renovação', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'lia@example.com',
    });

    await service.refresh('user-1', 'old-refresh-token');

    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
      where: {
        token: createHash('sha256').update('old-refresh-token').digest('hex'),
      },
    });
  });
});
