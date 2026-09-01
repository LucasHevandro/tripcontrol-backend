import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import * as client from '../generated/prisma/client';

@Controller('trips/:tripId/report')
@UseGuards(JwtGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('pdf')
  async downloadPdf(
    @Param('tripId') tripId: string,
    @CurrentUser() user: client.User,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.reportsService.generateTripReportPdf(
      tripId,
      user.id,
    );
    const filename = `tripcontrol-${tripId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }
}
