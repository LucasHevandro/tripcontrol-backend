import {
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  MinLength,
  MaxLength,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DestinationType, TripType } from '../../generated/prisma/enums';

function IsAfterDate(property: string, validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'isAfterDate',
      target: (target as { constructor: new (...args: unknown[]) => unknown })
        .constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: string, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as string[];
          const relatedObject = args.object as Record<string, unknown>;
          const relatedValue = relatedObject[relatedPropertyName];
          if (!value || !relatedValue) return true;
          return new Date(value) >= new Date(relatedValue as string);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} deve ser igual ou posterior à data de início`;
        },
      },
    });
  };
}

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

  @ApiPropertyOptional({ example: -30.0277 })
  @IsNumber()
  @IsOptional()
  destinationLat?: number;

  @ApiPropertyOptional({ example: -51.2288 })
  @IsNumber()
  @IsOptional()
  destinationLng?: number;

  @ApiPropertyOptional({ enum: DestinationType })
  @IsOptional()
  @IsEnum(DestinationType)
  destinationType?: DestinationType;

  @ApiProperty({ example: '2026-03-14' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-03-18' })
  @IsDateString()
  @IsAfterDate('startDate', {
    message: 'A data final deve ser igual ou posterior à data inicial',
  })
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
