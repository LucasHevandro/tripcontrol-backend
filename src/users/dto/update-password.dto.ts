import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
    @ApiProperty({ example: 'MinhaSenh@123' })
    @IsString()
    currentPassword: string;

    @ApiProperty({ example: 'NovaSenh@456', minLength: 8 })
    @IsString()
    @MinLength(8)
    @MaxLength(64)
    newPassword: string;
}