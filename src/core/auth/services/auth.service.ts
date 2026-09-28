import { EmailVerificationService } from './email-verification.service';
import { TokenService } from './token.service';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import * as bcrypt from 'bcrypt';
import { UUID, randomUUID } from 'node:crypto';

import { User } from '../../users/entities/user.entity';
import { AccountStatus, AuthProvider } from '../../users/enums/user.enum';
import { UsersService } from '../../users/services/users.service';
import { LoginAuthDto } from '../dto/login.dto';
import { RegisterAuthDto } from '../dto/register.dto';
import { LoginResponse, RegisterResponse } from '../types/auth-response.type';

@Injectable()
export class AuthService {
  private readonly DUMMY_PASSWORD_HASH =
    '$2b$12$MwL2hICCvJC6Ft2pCEb/o.TxXNtKk8bgxTDbE0SYclpdRrSxrpN0u';

  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findOneByEmailWithPassword(email);
    if (!user || !user.password) {
      await bcrypt.compare(password, this.DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    const now = Date.now();
    if (user.lockedUntil && user.lockedUntil.getTime() > now) {
      await bcrypt.compare(password, this.DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil) {
      await this.usersService.resetFailedAttempts(user.id);
      user.loginAttempts = 0;
      user.lockedUntil = null;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await this.usersService.incrementFailedAttempts(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.loginAttempts > 0) {
      await this.usersService.resetFailedAttempts(user.id);
    }

    if (!user.isVerified) {
      throw new ForbiddenException('Please verify your email to continue');
    }
    return user;
  }

  async register(registerAuthDto: RegisterAuthDto): Promise<RegisterResponse> {
    const existingUser = await this.usersService.findOneByEmail(
      registerAuthDto.email,
    );
    if (existingUser?.isVerified) {
      throw new BadRequestException('Email is already registered');
    }
    const passwordHash = await bcrypt.hash(registerAuthDto.password, 10);

    let userId: string;

    if (existingUser) {
      // Existing pending registration: refresh credentials and resend,
      // no new row is created.
      await this.usersService.update(existingUser.id as UUID, {
        password: passwordHash,
      });
      userId = existingUser.id;
    } else {
      const user = await this.usersService.create({
        email: registerAuthDto.email,
        name: registerAuthDto.email.split('@')[0],
        password: passwordHash,
        authProvider: AuthProvider.LOCAL,
        status: AccountStatus.PENDING_VERIFICATION,
        isVerified: false,
      });
      userId = user.id;
    }

    const rawToken = await this.emailVerificationService.createToken(userId);

    this.eventEmitter.emit('user.registered', {
      email: registerAuthDto.email,
      token: rawToken,
    });

    return { email: registerAuthDto.email };
  }

  async login(loginAuthDto: LoginAuthDto): Promise<LoginResponse> {
    const user = await this.validateUser(
      loginAuthDto.email,
      loginAuthDto.password,
    );
    return this.tokenService.issueTokenPair(user, randomUUID());
  }

  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
    photo?: string;
  }): Promise<User> {
    const existingByGoogleId = await this.usersService.findOneByGoogleId(
      profile.googleId,
    );
    if (existingByGoogleId) {
      return existingByGoogleId;
    }

    const existingByEmail = await this.usersService.findOneByEmailWithPassword(
      profile.email,
    );

    if (existingByEmail) {
      if (
        existingByEmail.googleId &&
        existingByEmail.googleId !== profile.googleId
      ) {
        throw new ConflictException(
          'This email is already linked to a different Google account.',
        );
      }

      await this.usersService.update(existingByEmail.id as UUID, {
        googleId: profile.googleId,
        authProvider: existingByEmail.password
          ? AuthProvider.HYBRID
          : AuthProvider.GOOGLE,
        isVerified: true,
        emailVerifiedAt: new Date(),
      });

      const updated = await this.usersService.findOneById(
        existingByEmail.id as UUID,
      );
      if (!updated) {
        throw new UnauthorizedException('Failed to load linked account');
      }
      return updated;
    }

    try {
      return await this.usersService.create({
        email: profile.email,
        name: profile.name,
        password: null,
        googleId: profile.googleId,
        authProvider: AuthProvider.GOOGLE,
        isVerified: true,
        emailVerifiedAt: new Date(),
        profilePicture: profile.photo,
      });
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        const winner = await this.usersService.findOneByGoogleId(
          profile.googleId,
        );
        if (winner) return winner;
      }
      throw err;
    }
  }

  async loginWithGoogle(profile: {
    googleId: string;
    email: string;
    name: string;
    photo?: string;
  }): Promise<LoginResponse> {
    const user = await this.findOrCreateGoogleUser(profile);
    return this.tokenService.issueTokenPair(user, randomUUID());
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    );
  }
}
