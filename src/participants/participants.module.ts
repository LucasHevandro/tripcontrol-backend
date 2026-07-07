import { Module } from '@nestjs/common';
import { ParticipantsController, JoinController } from './participants.controller';
import { ParticipantsService } from './participants.service';
import { TripsModule } from '../trips/trips.module';

@Module({
    imports: [TripsModule],
    controllers: [ParticipantsController, JoinController],
    providers: [ParticipantsService],
    exports: [ParticipantsService],
})
export class ParticipantsModule { }