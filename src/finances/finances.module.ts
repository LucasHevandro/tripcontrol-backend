import { Module } from '@nestjs/common';
import { BalanceCalculatorService } from './balance.service';

@Module({
    providers: [BalanceCalculatorService],
    exports: [BalanceCalculatorService],
})
export class FinancesModule { }