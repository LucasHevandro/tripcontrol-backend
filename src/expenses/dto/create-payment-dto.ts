import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePaymentDto {
    @IsUUID()
    fromUserId: string;

    @IsUUID()
    toUserId: string;

    @IsNumber()
    @Min(0.01)
    amount: number;

    @IsOptional()
    @IsString()
    notes?: string;
}