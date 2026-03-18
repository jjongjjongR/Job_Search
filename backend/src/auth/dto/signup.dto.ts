import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'test@example.com' })
  @IsEmail()
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
