import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'test@example.com' })
  @IsEmail()
  @Matches(/^[^\s@]+@gmail\.com$/i, {
    message: 'Gmail 주소만 사용할 수 있습니다.',
  })
  email: string;

  @ApiProperty({ example: 'jongheon' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: '이종헌' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiProperty({ example: '1234abcd!!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
