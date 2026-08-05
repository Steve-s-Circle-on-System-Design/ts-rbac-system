import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import type { UUID } from 'node:crypto';
import { DeleteResult, Repository, UpdateResult } from 'typeorm';

import { User } from '../auth/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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

  async isAccountLocked(userId: string): Promise<boolean> {
    const user = await this.usersRepository.findOneBy({ id: userId });

    if (!user?.lockedUntil) {
      return false;
    }

    return user.lockedUntil.getTime() > Date.now();
  }

  create(userInformation: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userInformation);
    return this.usersRepository.save(user);
  }

  findOneById(id: UUID): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({
      email: this.normalizeEmail(email),
    });
  }

  findOneByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: this.normalizeEmail(email) })
      .getOne();
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  update(id: UUID, userInformation: Partial<User>): Promise<UpdateResult> {
    return this.usersRepository.update(id, userInformation);
  }

  remove(id: UUID): Promise<DeleteResult> {
    return this.usersRepository.delete(id);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getPositiveIntegerConfig(key: string, fallback: number): number {
    const configuredValue = this.configService.get<number>(key, fallback);
    return Number.isInteger(configuredValue) && configuredValue > 0
      ? configuredValue
      : fallback;
  }
}
