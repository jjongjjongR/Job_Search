import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SignupDto } from './dto/signup.dto';
import { SocialLoginDto } from './dto/social-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOkResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: '이메일 또는 username 중복' })
  signup(@Body() signupDto: SignupDto): Promise<UserResponseDto> {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: '로그인 실패' })
  login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Get('verify-email')
  @ApiOkResponse({ type: UserResponseDto })
  verifyEmail(@Query('token') token: string): Promise<UserResponseDto> {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @ApiOkResponse({ description: '인증 메일 재발송' })
  resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerification(resendDto);
  }

  @Post('social-login')
  @ApiOkResponse({ type: LoginResponseDto })
  socialLogin(
    @Body() socialLoginDto: SocialLoginDto,
  ): Promise<LoginResponseDto> {
    return this.authService.socialLogin(socialLoginDto);
  }
}
