import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Lucas Hevandro' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'lucas@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MinhaSenh@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password?: string;

  @ApiPropertyOptional({ example: '(44) 99876-5432' })
  @IsOptional()
  @IsString()
  phone?: string;
}
