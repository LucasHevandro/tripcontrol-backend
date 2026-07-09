import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePaymentDto {
    @IsUUID()
    fromParticipantId: string;

    @IsUUID()
    toParticipantId: string;

    @IsNumber()
    @Min(0.01)
    amount: number;

    @IsOptional()
    @IsString()
    notes?: string;
}