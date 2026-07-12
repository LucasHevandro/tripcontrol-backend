import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateTripDto } from './create-trip.dto';
import { TripStatus } from '../../generated/prisma/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTripDto extends PartialType(CreateTripDto) {
  @ApiPropertyOptional({ enum: TripStatus })
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;
}
