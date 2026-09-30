import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { UsersService } from '../../users/services/users.service';
import { TokenService } from '../services/token.service';

@Injectable()
export class PendingUserCleanupJob {
  private readonly logger = new Logger(PendingUserCleanupJob.name);
  private readonly pendingUserMaxAgeMs = 3 * 60 * 60 * 1000; // matches token TTL

  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - this.pendingUserMaxAgeMs);

    const users =
      await this.usersService.removeStalePendingRegistrations(cutoff);
    const tokens = await this.tokenService.removeSpentEmailVerificationTokens();

    if (users.affected || tokens) {
      this.logger.log(
        `Cleanup: removed ${users.affected ?? 0} stale pending users, ${tokens} spent verification tokens`,
      );
    }
  }
}
