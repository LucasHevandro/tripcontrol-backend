import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TripsModule } from './trips/trips.module';
import { ParticipantsModule } from './participants/participants.module';
import { ExpensesModule } from './expenses/expenses.module';
import { RoadmapModule } from './roadmap/roadmap.module';
import { ReservationsModule } from './reservations/reservations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TripsModule,
    ParticipantsModule,
    ExpensesModule,
    RoadmapModule,
    ReservationsModule,
  ],
})
export class AppModule { }