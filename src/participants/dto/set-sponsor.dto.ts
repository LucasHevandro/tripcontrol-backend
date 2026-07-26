import { IsString, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetSponsorDto {
  @ApiProperty({ example: 'uuid-do-usuario-patrocinador', nullable: true })
  @ValidateIf((o: { sponsorId: string | null }) => o.sponsorId !== null)
  @IsString()
  sponsorId: string | null;
}
