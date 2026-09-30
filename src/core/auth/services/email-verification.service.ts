import { TokenService } from './token.service';

import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import type { UUID } from 'node:crypto';

import { AccountStatus } from '../../users/enums/user.enum';
import { UsersService } from '../../users/services/users.service';

@Injectable()
export class EmailVerificationService {
  // private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  createToken(userId: string): Promise<string> {
    return this.tokenService.issueEmailVerificationToken(userId);
  }

  async verifyEmail(rawToken: string): Promise<{ verified: boolean }> {
    const userId =
      await this.tokenService.verifyAndConsumeEmailVerificationToken(rawToken);
    if (!userId) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const user = await this.usersService.findOneById(userId as UUID);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.isVerified) {
      return { verified: true };
    }

    await this.usersService.update(user.id as UUID, {
      status: AccountStatus.ACTIVE,
      isVerified: true,
      emailVerifiedAt: new Date(),
    });

    this.eventEmitter.emit('user.verified', { email: user.email });

    return { verified: true };
  }
}
