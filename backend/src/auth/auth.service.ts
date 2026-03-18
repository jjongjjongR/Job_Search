import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupDto) {
    const passwordHash = await bcrypt.hash(signupDto.password, 10);
    const user = await this.usersService.createUser({
      email: signupDto.email,
      username: signupDto.username,
      displayName: signupDto.displayName,
      passwordHash,
    });

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

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
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
    });

    return this.issueLoginResponse(user);
  }

  private async issueLoginResponse(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role as UserRole,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.usersService.toResponse(user),
    };
  }
}
