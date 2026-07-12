import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsEnum,
  IsArray,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SplitType } from '../../generated/prisma/enums';

export class SplitParticipantDto {
  @ApiProperty({ example: 'uuid-do-participante' })
  @IsString()
  participantId: string;

  @ApiPropertyOptional({ example: 150.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class CreateExpenseDto {
  @ApiProperty({ example: 'Jantar na Beira Mar' })
  @IsString()
  @MinLength(2)
  description: string;

  @ApiProperty({ example: 280.0 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: '2026-01-14' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Alimentação' })
  @IsString()
  category: string;

  @ApiProperty({ example: 'uuid-do-usuario-que-pagou' })
  @IsString()
  paidById: string;

  @ApiPropertyOptional({ enum: SplitType, default: SplitType.EQUAL })
  @IsOptional()
  @IsEnum(SplitType)
  splitType?: SplitType;

  @ApiPropertyOptional({
    type: [SplitParticipantDto],
    description: 'IDs dos participantes que dividem a despesa',
  })
  @IsOptional()
  @IsArray()
  splitParticipants?: SplitParticipantDto[];

  @ApiPropertyOptional({ example: 'Mesa para 6 pessoas' })
  @IsOptional()
  @IsString()
  notes?: string;
}
