import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UserRole } from '../common/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { MailService } from './mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async signup(signupDto: SignupDto) {
    const existingUser = await this.usersService.findByEmail(signupDto.email);

    if (existingUser) {
      if (existingUser.isEmailVerified) {
        throw new ConflictException('이미 사용 중인 이메일입니다.');
      }

      await this.sendVerificationEmail(existingUser);
      return this.usersService.toResponse(existingUser);
    }

    this.mailService.assertEmailVerificationReady();

    const passwordHash = await bcrypt.hash(signupDto.password, 10);
    const user = await this.usersService.createUser({
      email: signupDto.email,
      username: signupDto.username,
      displayName: signupDto.displayName,
      passwordHash,
    });

    try {
      await this.sendVerificationEmail(user);
    } catch (error) {
      await this.usersService.deleteById(user.id);
      throw error;
    }

    return this.usersService.toResponse(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('이메일 인증 후 로그인할 수 있습니다.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.usersService.toResponse(user),
    };
  }

  async socialLogin(socialLoginDto: SocialLoginDto) {
    const existingUser = await this.usersService.findByEmail(socialLoginDto.email);

    if (existingUser) {
      return this.issueLoginResponse(existingUser);
    }

    const generatedUsername = await this.usersService.generateUniqueUsername(
      socialLoginDto.username ?? socialLoginDto.email.split('@')[0] ?? socialLoginDto.provider,
    );

    const passwordHash = await bcrypt.hash(
      `${socialLoginDto.provider}-${socialLoginDto.email}-${Date.now()}`,
      10,
    );

    const user = await this.usersService.createUser({
      email: socialLoginDto.email,
      username: generatedUsername,
      displayName: socialLoginDto.displayName,
      passwordHash,
      isEmailVerified: true,
    });

    return this.issueLoginResponse(user);
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('인증 토큰이 없습니다.');
    }

    const tokenHash = this.hashToken(token);
    const user = await this.usersService.verifyEmailByTokenHash(tokenHash);

    if (!user) {
      throw new BadRequestException('인증 링크가 유효하지 않거나 만료되었습니다.');
    }

    return this.usersService.toResponse(user);
  }

  async resendVerification(resendDto: ResendVerificationDto) {
    const user = await this.usersService.findByEmail(resendDto.email);

    if (!user) {
      throw new BadRequestException('가입된 이메일을 찾을 수 없습니다.');
    }

    if (user.isEmailVerified) {
      return { message: '이미 인증된 이메일입니다.' };
    }

    await this.sendVerificationEmail(user);

    return { message: '인증 메일을 다시 보냈습니다.' };
  }

  private async issueLoginResponse(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role as UserRole,
      isEmailVerified: user.isEmailVerified,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.usersService.toResponse(user),
    };
  }

  private async sendVerificationEmail(user: User) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ??
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:3000';
    const verificationUrl = `${frontendUrl.replace(/\/$/, '')}/verify-email?token=${token}`;

    await this.usersService.saveEmailVerificationToken(
      user.id,
      tokenHash,
      expiresAt,
    );
    await this.mailService.sendEmailVerification(user.email, verificationUrl);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
