import { Module } from '@nestjs/common';
import { ExpensesController, PaymentsController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { TripsModule } from '../trips/trips.module';

@Module({
    imports: [TripsModule],
    controllers: [ExpensesController, PaymentsController],
    providers: [ExpensesService],
    exports: [ExpensesService],
})
export class ExpensesModule { }