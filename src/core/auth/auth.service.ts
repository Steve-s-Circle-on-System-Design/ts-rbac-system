import { calculateExpiryDate } from './auth.utils';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';

import bcrypt from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';
import { UUID, createHmac, randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';

import { UsersService } from '../users/users.service';

import { CreateAuthDto } from './dto/create-auth.dto';
import { SendVerificationEmailPayload } from './dto/verification-email.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { AccountStatus } from './entities/user.entity';
import { User } from './entities/user.entity';
import {
  AuthTokenPayload,
  LoginResponse,
  RegisterResponse,
} from './interfaces/auth-response.interface';

const DUMMY_PASSWORD_HASH =
  '$2b$12$MwL2hICCvJC6Ft2pCEb/o.TxXNtKk8bgxTDbE0SYclpdRrSxrpN0u';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtRefreshSecret: string;
  private readonly jwtRefreshExpiry: string;
  private readonly refreshTokenHashSecret: string;
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {
    this.jwtRefreshSecret = this.configService.getOrThrow<string>(
      'appConfig.auth.jwtRefreshSecret',
    );
    this.jwtRefreshExpiry = this.configService.getOrThrow<string>(
      'appConfig.auth.jwtRefreshExpiry',
    );
    this.refreshTokenHashSecret = this.configService.getOrThrow<string>(
      'appConfig.auth.refreshTokenHashSecret',
    );
  }
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findOneByEmailWithPassword(email);
    if (!user || !user.password) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    const now = Date.now();
    if (user.lockedUntil && user.lockedUntil.getTime() > now) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
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

  async register(createAuthDto: CreateAuthDto): Promise<RegisterResponse> {
    const existingUser = await this.usersService.findOneByEmail(
      createAuthDto.email,
    );
    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(createAuthDto.password, 10);
    const user = await this.usersService.create({
      email: createAuthDto.email,
      name: createAuthDto.email.split('@')[0],
      password: hashedPassword,
    });

    const verificationToken = await this.verificationSecret({
      id: user.id,
      email: user.email,
    });

    const payload: SendVerificationEmailPayload = {
      email: user.email,
      token: verificationToken,
    };
    this.eventEmitter.emit('user.registered', payload);

    return {
      id: user.id,
      email: user.email,
    };
  }
  async login(createAuthDto: CreateAuthDto): Promise<LoginResponse> {
    const user = await this.validateUser(
      createAuthDto.email,
      createAuthDto.password,
    );

    const tokenFamily = randomUUID();
    return this.issueTokenPair(user, tokenFamily, this.refreshTokenRepository);
  }

  async verificationSecret(data: {
    id: string;
    email: string;
  }): Promise<string> {
    const payload = {
      sub: data.id,
      email: data.email,
      purpose: 'email-verification',
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>(
        'appConfig.auth.jwtVerificationSecret',
      ),
      expiresIn: '15m',
    });

    await this.usersService.update(data.id as UUID, {
      verificationToken: token,
    });

    return token;
  }

  async verifyEmail(token: string): Promise<{ verified: boolean }> {
    let payload: { sub: string; email: string; purpose: string };

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow<string>(
          'appConfig.auth.jwtVerificationSecret',
        ),
      });
    } catch (err) {
      this.logger.error('Email verification failed', err);
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (payload.purpose !== 'email-verification') {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const user = await this.usersService.findOneById(payload.sub as UUID);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.verificationToken !== token) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.update(user.id as UUID, {
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      isVerified: true,
      verificationToken: null,
    });

    return { verified: true };
  }

  /**
   * Rotates a refresh token and issues a new access/refresh token pair.
   *
   * Workflow:
   * 1. Verifies the refresh JWT signature before performing any database operation.
   *    This avoids unnecessary database queries for invalid tokens.
   *
   * 2. Starts a database transaction to ensure refresh token rotation is atomic.
   *    The old token is revoked and the replacement token is created within the
   *    same transaction, preventing inconsistent session states.
   *
   * 3. Retrieves the stored refresh token using its hashed value and applies a
   *    pessimistic database lock (`SELECT FOR UPDATE`) to prevent concurrent
   *    refresh requests from rotating the same token simultaneously.
   *
   * 4. Validates the token state:
   *    - Token exists.
   *    - Token has not already been revoked.
   *    - Token has not expired.
   *
   * 5. Detects refresh token reuse:
   *    If a previously revoked token is presented again, the request is treated
   *    as a potential token theft event. All active user sessions are revoked.
   *
   *    IMPORTANT: this revocation must be allowed to COMMIT even though the
   *    overall request will be rejected. If we threw an exception directly
   *    inside this transaction, TypeORM would roll back everything performed
   *    within it — including the revocation we just made — silently undoing
   *    the exact protection this step exists to provide. To avoid this, the
   *    transaction returns an outcome value instead of throwing, and the
   *    corresponding exception is thrown only after the transaction has
   *    already committed successfully.
   *
   * 6. Revokes the current refresh token and marks it as rotated.
   *
   * 7. Loads the associated user and generates a new token pair while preserving
   *    the existing token family for rotation tracking.
   *
   * 8. The transaction returns a discriminated outcome object rather than the
   *    final response directly. Once the transaction has committed, the outcome
   *    is translated into either a thrown UnauthorizedException or the successful
   *    token pair. This separation is what allows step 5's revocation to survive
   *    even on the rejected path.
   */
  async refreshTokens(refreshToken: string): Promise<LoginResponse> {
    let payload: AuthTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const tokenRepo = manager.getRepository(RefreshToken);

      const existingToken = await tokenRepo.findOne({
        where: { token: this.hashToken(refreshToken) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!existingToken) {
        return { outcome: 'not_found' as const };
      }

      if (existingToken.isRevoked()) {
        await this.revokeAllUserSessions(
          existingToken.userId,
          'reuse_detected',
          tokenRepo,
        );
        return { outcome: 'reuse_detected' as const };
      }

      if (existingToken.isExpired()) {
        return { outcome: 'expired' as const };
      }

      existingToken.revokedAt = new Date();
      existingToken.revokedReason = 'rotated';
      await tokenRepo.save(existingToken);

      const user = await this.usersService.findOneById(payload.sub as UUID);
      if (!user) {
        return { outcome: 'user_not_found' as const };
      }

      const tokens = await this.issueTokenPair(
        user,
        existingToken.tokenFamily,
        tokenRepo,
        existingToken.id,
      );
      return { outcome: 'success' as const, tokens };
    });

    switch (result.outcome) {
      case 'not_found':
        throw new UnauthorizedException('Invalid refresh token');
      case 'reuse_detected':
        throw new UnauthorizedException('Refresh token reuse detected');
      case 'expired':
        throw new UnauthorizedException('Refresh token expired');
      case 'user_not_found':
        throw new UnauthorizedException('User not found');
      case 'success':
        return result.tokens;
    }
  }

  /**
   * Revokes a user's refresh token to terminate the current session.
   *
   * Workflow:
   *
   * 1. Hashes the provided refresh token and searches for the matching token
   *    record in the database. Raw refresh tokens are never stored, so the
   *    lookup is performed against the stored hash.
   *
   * 2. Validates that the refresh token exists before allowing the logout
   *    operation to continue.
   *
   * 3. Marks the refresh token as revoked and records the reason as "logout".
   *    This prevents the token from being used again to obtain new access tokens.
   *
   * 4. Persists the revoked state to the database and confirms successful
   *    session termination.
   */
  async logout(refreshToken: string): Promise<{ message: string }> {
    const existingToken = await this.refreshTokenRepository.findOne({
      where: { token: this.hashToken(refreshToken) },
    });

    if (!existingToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    existingToken.revokedAt = new Date();
    existingToken.revokedReason = 'logout';
    await this.refreshTokenRepository.save(existingToken);

    return { message: 'Logged out successfully' };
  }

  /**
   * Revokes EVERY active refresh token belonging to a user, across all
   * devices/sessions — not just the one token family that was reused.
   * This is what "invalidate the user's active session footprint" means:
   * reuse of any token is treated as a full account compromise signal.
   */
  private async revokeAllUserSessions(
    userId: string,
    reason: string,
    repository: Repository<RefreshToken>,
  ): Promise<void> {
    await repository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where('userId = :userId', { userId })
      .andWhere('revokedAt IS NULL')
      .execute();
  }

  /**
   * Generates a new access token and refresh token pair for an authenticated user.
   *
   * Workflow:
   * 1. Creates the JWT payload containing user identity information.
   * 2. Signs a short-lived access token for API authorization.
   * 3. Signs a long-lived refresh token for session renewal.
   * 4. Calculates the refresh token expiration date based on configuration.
   * 5. Hashes the refresh token before storing it in the database to prevent
   *    storing raw authentication credentials.
   * 6. Persists the refresh token metadata, including token family and rotation
   *    relationship, to support refresh token rotation and reuse detection.
   *
   * Used by:
   * - Login flow: creates a new token family and initial refresh token.
   * - Refresh flow: creates a replacement refresh token linked to the previous
   *   token while maintaining the existing token family.
   *
   * The repository is passed explicitly so this method can participate in an
   * existing database transaction when called during refresh token rotation.
   */
  private async issueTokenPair(
    user: User,
    tokenFamily: string,
    repository: Repository<RefreshToken>,
    rotatedFrom?: string,
  ): Promise<LoginResponse> {
    const payload = { email: user.email, sub: user.id, role: user.role };

    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.jwtRefreshSecret,
      expiresIn: this.jwtRefreshExpiry as SignOptions['expiresIn'],
    });

    const expiresAt = calculateExpiryDate(this.jwtRefreshExpiry);

    const tokenEntity = repository.create({
      token: this.hashToken(refreshToken),
      tokenFamily,
      rotatedFrom,
      userId: user.id,
      expiresAt,
    });
    await repository.save(tokenEntity);

    return { accessToken, refreshToken };
  }

  /**
   * Computes a deterministic HMAC-SHA256 digest of a refresh token, using a
   * dedicated secret separate from jwtRefreshSecret. We hash before storing
   * so that if the refresh_tokens table is ever exposed (leak, backup theft,
   * etc.), the raw tokens usable for authentication are not sitting in the
   * database — only a digest that's useless without this server secret.
   */
  private hashToken(token: string): string {
    return createHmac('sha256', this.refreshTokenHashSecret)
      .update(token)
      .digest('hex');
  }
}
