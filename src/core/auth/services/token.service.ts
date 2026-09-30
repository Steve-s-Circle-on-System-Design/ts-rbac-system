import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';

import type { SignOptions } from 'jsonwebtoken';
import { type UUID, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, IsNull, Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { LoginResponse } from '../types/auth-response.type';
import { AuthTokenPayload } from '../types/auth.types';

@Injectable()
export class TokenService {
  private readonly jwtRefreshSecret: string;
  private readonly jwtRefreshExpiry: string;
  private readonly refreshTokenHashSecret: string;
  private readonly emailVerificationSecret: string;
  private readonly emailVerificationTtlMs = 3 * 60 * 60 * 1000; // 3 hours

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(EmailVerificationToken)
    private readonly verificationTokenRepository: Repository<EmailVerificationToken>,
    private readonly dataSource: DataSource,
  ) {
    this.jwtRefreshSecret = configService.getOrThrow<string>(
      'appConfig.auth.jwtRefreshSecret',
    );
    this.jwtRefreshExpiry = configService.getOrThrow<string>(
      'appConfig.auth.jwtRefreshExpiry',
    );
    this.refreshTokenHashSecret = configService.getOrThrow<string>(
      'appConfig.auth.refreshTokenHashSecret',
    );
    this.emailVerificationSecret = configService.getOrThrow<string>(
      'appConfig.auth.jwtVerificationSecret',
    );
  }

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
        where: { token: this.hashRefreshToken(refreshToken) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!existingToken) return { outcome: 'not_found' as const };
      if (existingToken.isRevoked()) {
        await this.revokeAllUserSessions(
          existingToken.userId,
          'reuse_detected',
          tokenRepo,
        );
        return { outcome: 'reuse_detected' as const };
      }
      if (existingToken.isExpired()) return { outcome: 'expired' as const };

      existingToken.revokedAt = new Date();
      existingToken.revokedReason = 'rotated';
      await tokenRepo.save(existingToken);

      const user = await this.usersService.findOneById(payload.sub as UUID);
      if (!user) return { outcome: 'user_not_found' as const };

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

  async logout(refreshToken: string): Promise<{ message: string }> {
    const existingToken = await this.refreshTokenRepository.findOne({
      where: { token: this.hashRefreshToken(refreshToken) },
    });
    if (!existingToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    existingToken.revokedAt = new Date();
    existingToken.revokedReason = 'logout';
    await this.refreshTokenRepository.save(existingToken);
    return { message: 'Logged out successfully' };
  }

  async issueTokenPair(
    user: User,
    tokenFamily: string,
    repository = this.refreshTokenRepository,
    rotatedFrom?: string,
  ): Promise<LoginResponse> {
    const payload = { email: user.email, sub: user.id, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, jti: randomUUID() },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiry as SignOptions['expiresIn'],
      },
    );

    const tokenEntity = repository.create({
      token: this.hashRefreshToken(refreshToken),
      tokenFamily,
      rotatedFrom,
      userId: user.id,
      expiresAt: this.calculateExpiryDate(this.jwtRefreshExpiry),
    });
    await repository.save(tokenEntity);
    return { accessToken, refreshToken };
  }

  /**
   * Issues a one-time email-verification token. Only the hash is stored;
   * the raw token is returned to be emailed and is never persisted.
   * Any earlier unconsumed token for this user is invalidated first.
   */
  async issueEmailVerificationToken(userId: string): Promise<string> {
    await this.verificationTokenRepository.delete({
      userId,
      consumedAt: IsNull(),
    });

    const rawToken = randomBytes(32).toString('hex');

    await this.verificationTokenRepository.save(
      this.verificationTokenRepository.create({
        tokenHash: this.hashEmailVerificationToken(rawToken),
        userId,
        expiresAt: new Date(Date.now() + this.emailVerificationTtlMs),
      }),
    );

    return rawToken;
  }

  /**
   * Atomically consumes a valid (unexpired, unconsumed) token and returns
   * its user id, or null. A single conditional UPDATE guarantees two
   * concurrent requests can't both consume the same token.
   */
  async verifyAndConsumeEmailVerificationToken(
    rawToken: string,
  ): Promise<string | null> {
    const now = new Date();

    const result = await this.verificationTokenRepository
      .createQueryBuilder()
      .update(EmailVerificationToken)
      .set({ consumedAt: now })
      .where('tokenHash = :tokenHash', {
        tokenHash: this.hashEmailVerificationToken(rawToken),
      })
      .andWhere('consumedAt IS NULL')
      .andWhere('expiresAt > :now', { now })
      .returning('userId')
      .execute();

    const rows = result.raw as { userId: string }[];
    return rows[0]?.userId ?? null;
  }

  /** Housekeeping: removes tokens that are expired or already consumed. */
  async removeSpentEmailVerificationTokens(): Promise<number> {
    const result = await this.verificationTokenRepository
      .createQueryBuilder()
      .delete()
      .from(EmailVerificationToken)
      .where('expiresAt < :now', { now: new Date() })
      .orWhere('consumedAt IS NOT NULL')
      .execute();

    return result.affected ?? 0;
  }

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

  private calculateExpiryDate(duration: string): Date {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) throw new Error(`Invalid duration format: ${duration}`);
    const units: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(Date.now() + parseInt(match[1], 10) * units[match[2]]);
  }

  private hashRefreshToken(token: string): string {
    return this.hmac(token, this.refreshTokenHashSecret);
  }

  private hashEmailVerificationToken(token: string): string {
    return this.hmac(token, this.emailVerificationSecret);
  }

  private hmac(value: string, secret: string): string {
    return createHmac('sha256', secret).update(value).digest('hex');
  }
}
