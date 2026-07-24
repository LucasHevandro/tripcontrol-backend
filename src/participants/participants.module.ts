import { Module } from '@nestjs/common';
import {
  ParticipantsController,
  JoinController,
} from './participants.controller';
import { ParticipantsService } from './participants.service';
import { TripsModule } from '../trips/trips.module';
import { EmailModule } from '../email/email.module';
import { FinancesModule } from '../finances/finances.module';

@Module({
  imports: [TripsModule, EmailModule, FinancesModule],
  controllers: [ParticipantsController, JoinController],
  providers: [ParticipantsService],
})
export class ParticipantsModule {}
