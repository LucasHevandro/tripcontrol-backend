import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description:
      'ID token (JWT) retornado pelo Google Identity Services no frontend',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
  })
  @IsString()
  @IsNotEmpty()
  credential: string;
}
