import { EmailVerificationService } from './email-verification.service';
import { TokenService } from './token.service';

import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AccountStatus } from '../../users/enums/user.enum';
import { UsersService } from '../../users/services/users.service';

describe('EmailVerificationService', () => {
  const users = { findOneById: jest.fn(), update: jest.fn() };
  const tokens = {
    issueEmailVerificationToken: jest.fn(),
    verifyAndConsumeEmailVerificationToken: jest.fn(),
  };
  const events = { emit: jest.fn() };

  let service: EmailVerificationService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new EmailVerificationService(
      users as unknown as UsersService,
      tokens as unknown as TokenService,
      events as unknown as EventEmitter2,
    );
  });

  it('delegates token creation to TokenService', async () => {
    tokens.issueEmailVerificationToken.mockResolvedValue('raw-token');

    await expect(service.createToken('user-1')).resolves.toBe('raw-token');
    expect(tokens.issueEmailVerificationToken).toHaveBeenCalledWith('user-1');
  });

  it('activates the account and emits user.verified on a valid token', async () => {
    tokens.verifyAndConsumeEmailVerificationToken.mockResolvedValue('user-1');
    users.findOneById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      isVerified: false,
    });

    await expect(service.verifyEmail('token')).resolves.toEqual({
      verified: true,
    });
    expect(users.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        status: AccountStatus.ACTIVE,
        isVerified: true,
      }),
    );
    expect(events.emit).toHaveBeenCalledWith('user.verified', {
      email: 'user@example.com',
    });
  });

  it('rejects an invalid, expired or already-used token', async () => {
    tokens.verifyAndConsumeEmailVerificationToken.mockResolvedValue(null);

    await expect(service.verifyEmail('token')).rejects.toEqual(
      new BadRequestException('Invalid or expired verification token'),
    );
    expect(users.update).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('rejects when the token maps to a user that no longer exists', async () => {
    tokens.verifyAndConsumeEmailVerificationToken.mockResolvedValue('user-1');
    users.findOneById.mockResolvedValue(null);

    await expect(service.verifyEmail('token')).rejects.toEqual(
      new BadRequestException('Invalid or expired verification token'),
    );
  });

  it('succeeds without re-activating or re-emitting for an already-verified user', async () => {
    tokens.verifyAndConsumeEmailVerificationToken.mockResolvedValue('user-1');
    users.findOneById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      isVerified: true,
    });

    await expect(service.verifyEmail('token')).resolves.toEqual({
      verified: true,
    });
    expect(users.update).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
