import { Module } from '@nestjs/common';
import { ExpensesController, PaymentsController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { TripsModule } from '../trips/trips.module';
import { FinancesModule } from '../finances/finances.module';

@Module({
    imports: [TripsModule, FinancesModule],
    controllers: [ExpensesController, PaymentsController],
    providers: [ExpensesService],
    exports: [ExpensesService],
})
export class ExpensesModule { }