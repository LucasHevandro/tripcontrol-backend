import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { FinancesModule } from 'src/finances/finances.module';

@Module({
    imports: [FinancesModule],
    controllers: [TripsController],
    providers: [TripsService],
    exports: [TripsService],
})
export class TripsModule { }