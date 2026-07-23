import { IsString, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetSponsorDto {
  @ApiProperty({ example: 'uuid-do-usuario-patrocinador', nullable: true })
  @ValidateIf((o) => o.sponsorId !== null)
  @IsString()
  sponsorId: string | null;
}
