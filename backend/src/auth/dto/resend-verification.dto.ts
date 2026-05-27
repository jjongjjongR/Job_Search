import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@gmail.com' })
  @IsEmail()
  @Matches(/^[^\s@]+@gmail\.com$/i, {
    message: 'Gmail 주소만 사용할 수 있습니다.',
  })
  email: string;
}
