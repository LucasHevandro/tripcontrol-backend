import {
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityStatus, CostType } from '../../generated/prisma/enums';

export class CreateActivityDto {
  @ApiProperty({ example: '🍽️' })
  @IsString()
  emoji: string;

  @ApiProperty({ example: 'Almoço no Restaurante Náutico' })
  @IsString()
  @MinLength(2)
  title: string;

  @ApiProperty({ example: '2026-01-14' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '13:00' })
  @IsString()
  startTime: string;

  @ApiPropertyOptional({ example: '1h30' })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({ example: 'Centro, Florianópolis' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 60.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costAmount?: number;

  @ApiPropertyOptional({ enum: CostType, default: CostType.FREE })
  @IsOptional()
  @IsEnum(CostType)
  costType?: CostType;

  @ApiPropertyOptional({ example: 'Reserva confirmada · Mesa para 6' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    enum: ActivityStatus,
    default: ActivityStatus.UPCOMING,
  })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;
}
