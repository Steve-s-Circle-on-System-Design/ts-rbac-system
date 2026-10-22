import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { User } from '../entities/user.entity';

@Injectable()
export class UserLockoutService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async incrementFailedAttempts(userId: string): Promise<void> {
    const maxAttempts = this.getPositiveIntegerConfig(
      'appConfig.auth.lockoutMaxAttempts',
      5,
    );
    const durationSeconds = this.getPositiveIntegerConfig(
      'appConfig.auth.lockoutDurationSeconds',
      15 * 60,
    );

    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({
        loginAttempts: () => '"loginAttempts" + 1',
        lockedUntil: () =>
          `CASE WHEN "loginAttempts" + 1 >= ${maxAttempts} ` +
          `THEN CURRENT_TIMESTAMP + INTERVAL '${durationSeconds} seconds' ` +
          'ELSE "lockedUntil" END',
      })
      .where('id = :userId', { userId })
      .execute();
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      loginAttempts: 0,
      lockedUntil: null,
    });
  }

  isLocked(user: User | null | undefined): boolean {
    if (!user?.lockedUntil) {
      return false;
    }
    return user.lockedUntil.getTime() > Date.now();
  }

  async isAccountLocked(userId: string): Promise<boolean> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    return this.isLocked(user);
  }

  private getPositiveIntegerConfig(key: string, fallback: number): number {
    const configuredValue = this.configService.get<number>(key, fallback);
    return Number.isInteger(configuredValue) && configuredValue > 0
      ? configuredValue
      : fallback;
  }
}
