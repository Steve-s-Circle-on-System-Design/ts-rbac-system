import { TokenService } from './token.service';

import { UnauthorizedException } from '@nestjs/common';

import { UsersService } from '../../users/services/users.service';
import { RefreshToken } from '../entities/refresh-token.entity';

describe('TokenService', () => {
  const users = { findOneById: jest.fn() };
  const jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };
  const config = { getOrThrow: jest.fn() };
  const refreshRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  interface CreatedVerificationToken {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }
  const verificationRepository = {
    delete: jest.fn(),
    save: jest.fn(),
    create: jest.fn<CreatedVerificationToken, [CreatedVerificationToken]>(),
    createQueryBuilder: jest.fn(),
  };
  const dataSource = { transaction: jest.fn() };

  // Chainable query-builder mock used by verifyAndConsumeEmailVerificationToken
  const queryBuilder = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn<unknown, [string, { tokenHash: string }]>(),
    andWhere: jest.fn(),
    returning: jest.fn(),
    execute: jest.fn(),
  };

  let service: TokenService;

  beforeEach(() => {
    jest.resetAllMocks();

    config.getOrThrow.mockImplementation(
      (key: string) =>
        ({
          'appConfig.auth.jwtRefreshSecret': 'refresh-secret',
          'appConfig.auth.jwtRefreshExpiry': '7d',
          'appConfig.auth.refreshTokenHashSecret': 'hash-secret',
          'appConfig.auth.jwtVerificationSecret': 'verification-secret',
        })[key],
    );
    refreshRepository.create.mockImplementation(
      (value: Partial<RefreshToken>) => value,
    );
    verificationRepository.create.mockImplementation((value) => value);

    queryBuilder.update.mockReturnValue(queryBuilder);
    queryBuilder.set.mockReturnValue(queryBuilder);
    queryBuilder.where.mockImplementation(() => queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.returning.mockReturnValue(queryBuilder);
    verificationRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    service = new TokenService(
      users as unknown as UsersService,
      jwt as never,
      config as never,
      refreshRepository as never,
      verificationRepository as never,
      dataSource as never,
    );
  });

  it('rejects an invalid refresh token before querying the database', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('invalid'));
    await expect(service.refreshTokens('bad-token')).rejects.toEqual(
      new UnauthorizedException('Invalid or expired refresh token'),
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('revokes and saves a matching refresh token on logout', async () => {
    const token = {
      revokedAt: null,
      revokedReason: null,
    } as unknown as RefreshToken;
    refreshRepository.findOne.mockResolvedValue(token);

    await expect(service.logout('refresh-token')).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(token.revokedReason).toBe('logout');
    expect(refreshRepository.save).toHaveBeenCalledWith(token);
  });

  describe('issueEmailVerificationToken', () => {
    it('invalidates earlier tokens, stores only the hash, and returns the raw token', async () => {
      const raw = await service.issueEmailVerificationToken('user-1');

      expect(verificationRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );

      const [saved] = verificationRepository.create.mock.calls[0];
      expect(raw).toMatch(/^[0-9a-f]{64}$/);
      expect(saved.tokenHash).not.toBe(raw);
      expect(saved.userId).toBe('user-1');
      expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(verificationRepository.save).toHaveBeenCalled();
    });
  });

  describe('verifyAndConsumeEmailVerificationToken', () => {
    it('returns the user id when the token is valid and unconsumed', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [{ userId: 'user-1' }] });

      await expect(
        service.verifyAndConsumeEmailVerificationToken('raw-token'),
      ).resolves.toBe('user-1');

      // The raw token must never be used directly in the query
      const [, params] = queryBuilder.where.mock.calls[0];
      expect(params.tokenHash).not.toBe('raw-token');
    });

    it('returns null when no row was consumed (invalid, expired or used)', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [] });

      await expect(
        service.verifyAndConsumeEmailVerificationToken('raw-token'),
      ).resolves.toBeNull();
    });
  });
});
