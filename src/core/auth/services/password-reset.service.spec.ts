import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';

import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import { PasswordReset } from '../entities/password-reset.entity';
import { RefreshToken } from '../entities/refresh-token.entity';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

describe('PasswordResetService', () => {
  const users = {
    findOneByEmail: jest.fn(),
    findOneById: jest.fn(),
    update: jest.fn(),
  };
  const tokens = {
    revokeAllUserSessions: jest.fn(),
  };
  const tokensRepo = {};
  const passwordResets = {
    update: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn().mockImplementation((entity: unknown) => {
      if (entity === PasswordReset) return passwordResets;
      if (entity === User) return users;
      if (entity === RefreshToken) return tokensRepo;
      return {};
    }),
  };
  const dataSource = {
    transaction: jest
      .fn()
      .mockImplementation(async (cb: (m: typeof manager) => Promise<unknown>) =>
        cb(manager),
      ),
  };
  const jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('reset-secret') };
  const events = { emit: jest.fn() };

  const service = new PasswordResetService(
    users as unknown as UsersService,
    tokens as unknown as TokenService,
    jwt as never,
    config as never,
    events as unknown as EventEmitter2,
    passwordResets as unknown as Repository<PasswordReset>,
    dataSource as unknown as DataSource,
  );

  const hash = bcrypt.hash as jest.Mock;
  const compare = bcrypt.compare as jest.Mock;

  const sha256 = (val: string): string =>
    createHash('sha256').update(val).digest('hex');

  beforeEach(() => {
    jest.resetAllMocks();
    manager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === PasswordReset) return passwordResets;
      if (entity === User) return users;
      if (entity === RefreshToken) return tokensRepo;
      return {};
    });
    dataSource.transaction.mockImplementation(
      async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager),
    );
  });

  it('stores a deterministic SHA-256 hashed reset token and emits user.forgot-password', async () => {
    users.findOneByEmail.mockResolvedValue({ id: 'user-id' });
    jwt.signAsync.mockResolvedValue('reset-token');
    passwordResets.create.mockImplementation(
      (dto: Partial<PasswordReset>): Partial<PasswordReset> => dto,
    );

    await service.forgotPassword('user@example.com');
    expect(passwordResets.update).toHaveBeenCalledWith(
      { userId: 'user-id', isUsed: false },
      { isUsed: true },
    );
    expect(passwordResets.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        token: sha256('reset-token'),
        isUsed: false,
      }),
    );
    expect(events.emit).toHaveBeenCalledWith('user.forgot-password', {
      email: 'user@example.com',
      token: 'reset-token',
    });
  });

  it('performs timing mitigation work if user is not found during forgotPassword', async () => {
    users.findOneByEmail.mockResolvedValue(null);

    await service.forgotPassword('unknown@example.com');
    expect(compare).toHaveBeenCalledWith('dummy', expect.any(String));
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('rejects an invalid reset token with uniform error', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('expired'));
    await expect(service.resetPassword('bad', 'password123')).rejects.toEqual(
      new BadRequestException('Invalid or expired reset token'),
    );
  });

  it('updates the password and revokes sessions in an atomic transaction after a valid reset', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-id',
      purpose: 'password-reset',
    });
    users.findOneById.mockResolvedValue({
      id: 'user-id',
    });
    const resetRecord = {
      id: 'reset-id',
      userId: 'user-id',
      token: sha256('token'),
      isUsed: false,
    };
    passwordResets.findOne.mockResolvedValue(resetRecord);
    hash.mockResolvedValue('new-password-hash');

    await expect(
      service.resetPassword('token', 'password123'),
    ).resolves.toEqual({
      message: 'Password has been reset successfully.',
    });

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(passwordResets.update).toHaveBeenCalledWith('reset-id', {
      isUsed: true,
    });
    expect(users.update).toHaveBeenCalledWith('user-id', {
      password: 'new-password-hash',
      loginAttempts: 0,
    });
    expect(tokens.revokeAllUserSessions).toHaveBeenCalledWith(
      'user-id',
      'Password reset',
      tokensRepo,
    );
  });
});
