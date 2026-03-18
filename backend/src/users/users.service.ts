import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from './entities/user.entity';

export interface CreateUserParams {
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role?: UserRole;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async createUser(params: CreateUserParams): Promise<User> {
    const existingEmailUser = await this.usersRepository.findOne({
      where: { email: params.email },
    });

    if (existingEmailUser) {
      throw new ConflictException('이미 사용 중인 이메일입니다.');
    }

    const existingUsernameUser = await this.usersRepository.findOne({
      where: { username: params.username },
    });

    if (existingUsernameUser) {
      throw new ConflictException('이미 사용 중인 username입니다.');
    }

    const user = this.usersRepository.create({
      ...params,
      role: params.role ?? UserRole.USER,
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async generateUniqueUsername(seed: string): Promise<string> {
    const normalizedSeed = seed
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);
    const baseUsername = normalizedSeed || 'socialuser';

    let candidate = baseUsername;
    let suffix = 1;

    while (await this.findByUsername(candidate)) {
      candidate = `${baseUsername}${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return user;
  }

  toResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    };
  }
}
