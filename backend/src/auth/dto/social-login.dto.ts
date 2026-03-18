import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({ enum: ['kakao', 'naver'] })
  @IsIn(['kakao', 'naver'])
  provider: 'kakao' | 'naver';

  @ApiProperty({ example: 'social@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '소셜 사용자' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiProperty({ example: 'social-user', required: false })
  @IsOptional()
  @IsString()
  username?: string;
}
