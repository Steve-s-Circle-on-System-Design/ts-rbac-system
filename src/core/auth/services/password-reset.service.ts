import { TokenService } from './token.service';

import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';

import * as bcrypt from 'bcrypt';
import { type UUID, createHash } from 'node:crypto';
import { DataSource, MoreThan, Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import { PasswordReset } from '../entities/password-reset.entity';
import { RefreshToken } from '../entities/refresh-token.entity';

const DUMMY_PASSWORD_HASH =
  '$2b$12$MwL2hICCvJC6Ft2pCEb/o.TxXNtKk8bgxTDbE0SYclpdRrSxrpN0u';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    private readonly dataSource: DataSource,
  ) {}

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      // Mitigate timing attack (user enumeration)
      await bcrypt.compare('dummy', DUMMY_PASSWORD_HASH);
      return;
    }

    const token = await this.jwtService.signAsync(
      { sub: user.id, purpose: 'password-reset' },
      {
        secret: this.configService.getOrThrow<string>(
          'appConfig.auth.jwtResetSecret',
        ),
        expiresIn: '15m',
      },
    );

    await this.passwordResetRepository.update(
      { userId: user.id, isUsed: false },
      { isUsed: true },
    );

    await this.passwordResetRepository.save(
      this.passwordResetRepository.create({
        userId: user.id,
        token: this.hashToken(token),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        isUsed: false,
      }),
    );

    this.eventEmitter.emit('user.forgot-password', { email, token });
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    let payload: { sub: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow<string>(
          'appConfig.auth.jwtResetSecret',
        ),
      });
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (payload.purpose !== 'password-reset') {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.usersService.findOneById(payload.sub as UUID);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedToken = this.hashToken(token);
    const resetRecord = await this.passwordResetRepository.findOne({
      where: {
        token: hashedToken,
        userId: user.id,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(PasswordReset).update(resetRecord.id, {
        isUsed: true,
      });

      await manager.getRepository(User).update(user.id, {
        password: hashedPassword,
        loginAttempts: 0,
      });

      await this.tokenService.revokeAllUserSessions(
        user.id,
        'Password reset',
        manager.getRepository(RefreshToken),
      );
    });

    return { message: 'Password has been reset successfully.' };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
