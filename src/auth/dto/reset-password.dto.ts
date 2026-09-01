import { IsString, MinLength, IsNotEmpty } from "class-validator";

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password: string;
}