import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePreferencesDto {
    @ApiPropertyOptional({ example: 'pt-BR' })
    @IsOptional()
    @IsString()
    language?: string;

    @ApiPropertyOptional({ example: 'BRL' })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    notifyEmail?: boolean;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    notifyExpenseAlerts?: boolean;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    notifyRoadmapReminders?: boolean;
}