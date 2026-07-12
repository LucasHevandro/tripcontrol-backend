import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReservationCategory } from '../generated/prisma/enums';

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('trips/:tripId/reservations')
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar reservas da viagem com estatísticas' })
  @ApiQuery({ name: 'category', enum: ReservationCategory, required: false })
  findAll(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Query('category') category?: ReservationCategory,
  ) {
    return this.reservationsService.findAll(user.id, tripId, category);
  }

  @Post()
  @ApiOperation({ summary: 'Criar nova reserva' })
  create(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationsService.create(user.id, tripId, dto);
  }

  @Patch(':reservationId')
  @ApiOperation({ summary: 'Editar reserva' })
  update(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Param('reservationId') reservationId: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(user.id, tripId, reservationId, dto);
  }

  @Delete(':reservationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover reserva' })
  remove(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Param('reservationId') reservationId: string,
  ) {
    return this.reservationsService.remove(user.id, tripId, reservationId);
  }
}
