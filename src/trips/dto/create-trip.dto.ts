import {
    IsString,
    IsDateString,
    IsOptional,
    IsEnum,
    IsNumber,
    Min,
    MinLength,
    MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripType, DestinationType } from '../../generated/prisma/client';

export class CreateTripDto {
    @ApiProperty({ example: 'Serra Gaúcha 2026' })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @ApiProperty({ example: 'Rio Grande do Sul, BR' })
    @IsString()
    @MinLength(2)
    destination: string;

    @ApiPropertyOptional({ enum: DestinationType })
    @IsOptional()
    @IsEnum(DestinationType)
    destinationType?: DestinationType;

    @ApiProperty({ example: '2026-03-14' })
    @IsDateString()
    startDate: string;

    @ApiProperty({ example: '2026-03-18' })
    @IsDateString()
    endDate: string;

    @ApiPropertyOptional({ enum: TripType })
    @IsOptional()
    @IsEnum(TripType)
    tripType?: TripType;

    @ApiPropertyOptional({ example: 2000 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    budget?: number;

    @ApiPropertyOptional({ example: 'Final de semana na serra com os amigos.' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: '🏔️' })
    @IsOptional()
    @IsString()
    emoji?: string;
}