import { UserLockoutService } from './user-lockout.service';

import { ConfigService } from '@nestjs/config';

import { Repository } from 'typeorm';

import { User } from '../entities/user.entity';

describe('UserLockoutService', () => {
  type LockoutUpdate = {
    loginAttempts: () => string;
    lockedUntil: () => string;
  };

  let service: UserLockoutService;
  let repository: {
    createQueryBuilder: jest.Mock;
    findOneBy: jest.Mock;
    update: jest.Mock;
  };
  let queryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    execute: jest.Mock;
  };
  let config: { get: jest.Mock };
  let lockoutUpdate: LockoutUpdate | undefined;

  const getLockoutUpdate = (): LockoutUpdate => {
    if (!lockoutUpdate) {
      throw new Error('Expected the query builder set payload');
    }
    return lockoutUpdate;
  };

  beforeEach(() => {
    queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    lockoutUpdate = undefined;
    queryBuilder.set.mockImplementation(
      (value: LockoutUpdate): typeof queryBuilder => {
        lockoutUpdate = value;
        return queryBuilder;
      },
    );
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOneBy: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    config = {
      get: jest.fn((_key: string, fallback: number): number => fallback),
    };
    service = new UserLockoutService(
      repository as unknown as Repository<User>,
      config as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('increments failures and applies the lock threshold atomically', async () => {
    const userId = '1aa6c952-c649-4d02-8f5b-d705caea7f75';

    await service.incrementFailedAttempts(userId);

    expect(queryBuilder.set).toHaveBeenCalledTimes(1);
    const update = getLockoutUpdate();
    expect(update.loginAttempts()).toBe('"loginAttempts" + 1');
    expect(update.lockedUntil()).toContain('"loginAttempts" + 1 >= 5');
    expect(update.lockedUntil()).toContain("INTERVAL '900 seconds'");
    expect(queryBuilder.where).toHaveBeenCalledWith('id = :userId', {
      userId,
    });
    expect(queryBuilder.execute).toHaveBeenCalledTimes(1);
  });

  it('uses valid configured lockout values', async () => {
    config.get.mockReturnValueOnce(3).mockReturnValueOnce(120);

    await service.incrementFailedAttempts('user-id');

    const update = getLockoutUpdate();
    expect(update.lockedUntil()).toContain('>= 3');
    expect(update.lockedUntil()).toContain("INTERVAL '120 seconds'");
  });

  it('falls back when lockout configuration is invalid', async () => {
    config.get.mockReturnValueOnce(0).mockReturnValueOnce(Number.NaN);

    await service.incrementFailedAttempts('user-id');

    const update = getLockoutUpdate();
    expect(update.lockedUntil()).toContain('>= 5');
    expect(update.lockedUntil()).toContain("INTERVAL '900 seconds'");
  });

  it('resets attempts and the lock together', async () => {
    await service.resetFailedAttempts('user-id');

    expect(repository.update).toHaveBeenCalledWith('user-id', {
      loginAttempts: 0,
      lockedUntil: null,
    });
  });

  it.each([
    ['missing', null, false],
    ['future', 1, true],
    ['exact boundary', 0, false],
    ['past', -1, false],
  ])(
    'reports a %s lock correctly',
    async (_label, offset: number | null, expected) => {
      const now = new Date('2026-07-30T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      repository.findOneBy.mockResolvedValue({
        lockedUntil: offset === null ? null : new Date(now.getTime() + offset),
      });

      await expect(service.isAccountLocked('user-id')).resolves.toBe(expected);
    },
  );

  it('checks isLocked directly on User instance without querying database', () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    expect(service.isLocked({ lockedUntil: future } as User)).toBe(true);
    expect(service.isLocked({ lockedUntil: past } as User)).toBe(false);
    expect(service.isLocked({ lockedUntil: null } as User)).toBe(false);
    expect(service.isLocked(null)).toBe(false);
    expect(repository.findOneBy).not.toHaveBeenCalled();
  });
});
