import { IsEmail, IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteByEmailDto {
    @ApiProperty({ example: ['ana@email.com', 'pedro@email.com'] })
    @IsArray()
    @ArrayMinSize(1)
    @IsEmail({}, { each: true })
    emails: string[];
}