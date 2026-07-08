import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({ example: 'lucas@email.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'MinhaSenh@123' })
    @IsString()
    @MinLength(8)
    password?: string; // Opcional para login via Google
}