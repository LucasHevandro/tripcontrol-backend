import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsObject,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ReservationCategory,
  ReservationStatus,
} from '../../generated/prisma/enums';

export class CreateReservationDto {
  @ApiProperty({ enum: ReservationCategory })
  @IsEnum(ReservationCategory)
  category: ReservationCategory;

  @ApiProperty({ example: 'Hotel Beira Mar Inn' })
  @IsString()
  @MinLength(2)
  title: string;

  @ApiPropertyOptional({ example: 'Hospedagem · Florianópolis' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiProperty({ example: 1800 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 'uuid-do-usuario-que-pagou' })
  @IsOptional()
  @IsString()
  paidById?: string;

  @ApiPropertyOptional({ example: 'Café da manhã incluído' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Campos específicos por categoria (hotel, voo, carro, passeio)',
    example: {
      checkIn: '2026-01-10',
      checkOut: '2026-01-17',
      guestCount: '6',
      roomCount: '3',
      address: 'Av. Beira Mar Norte, 1.200',
      reservationCode: '#BM2026-0110',
    },
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}
