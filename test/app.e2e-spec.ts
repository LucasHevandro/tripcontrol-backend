import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

jest.mock('../src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {
    $connect = jest.fn();
    $disconnect = jest.fn();
  },
}));

describe('TripControl API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejeita cadastro inválido antes de chamar regra de negócio', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'invalido' })
      .expect(400);
  });

  it('protege rota autenticada sem bearer token', () => {
    return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });
});
