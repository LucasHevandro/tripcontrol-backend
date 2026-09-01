import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { FinancesModule } from '../finances/finances.module';

@Module({
  imports: [FinancesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
