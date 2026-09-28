import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { TokenService } from './token.service';

import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import * as bcrypt from 'bcrypt';

import { User } from '../../users/entities/user.entity';
import {
  AccountStatus,
  AuthProvider,
  UserRole,
} from '../../users/enums/user.enum';
import { UsersService } from '../../users/services/users.service';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

describe('AuthService', () => {
  const user = (overrides: Partial<User> = {}): User =>
    ({
      id: 'user-id',
      email: 'user@example.com',
      name: 'user',
      password: 'hashed-password',
      role: UserRole.USER,
      status: AccountStatus.ACTIVE,
      isVerified: true,
      emailVerifiedAt: new Date(),
      loginAttempts: 0,
      lockedUntil: null,
      ...overrides,
    }) as User;

  let service: AuthService;
  let users: Record<string, jest.Mock>;
  let tokens: Record<string, jest.Mock>;
  let verification: Record<string, jest.Mock>;
  let events: { emit: jest.Mock };
  const compare = bcrypt.compare as jest.Mock;
  const hash = bcrypt.hash as jest.Mock;

  beforeEach(() => {
    users = {
      findOneByEmailWithPassword: jest.fn(),
      findOneByEmail: jest.fn(),
      findOneByGoogleId: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      resetFailedAttempts: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findOneById: jest.fn(),
    };
    tokens = { issueTokenPair: jest.fn() };
    verification = { createToken: jest.fn() };
    events = { emit: jest.fn() };
    compare.mockReset();
    hash.mockReset();
    service = new AuthService(
      users as unknown as UsersService,
      tokens as unknown as TokenService,
      verification as unknown as EmailVerificationService,
      events as unknown as EventEmitter2,
    );
  });

  it('rejects a duplicate registration before hashing', async () => {
    users.findOneByEmail.mockResolvedValue(user());

    await expect(
      service.register({ email: 'user@example.com', password: 'password123' }),
    ).rejects.toEqual(new BadRequestException('Email is already registered'));
    expect(hash).not.toHaveBeenCalled();
  });

  it('creates a user, creates a verification token, and emits an event', async () => {
    const createdUser = user({ id: 'new-user', email: 'new@example.com' });
    users.findOneByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(createdUser);
    hash.mockResolvedValue('hashed-password');
    verification.createToken.mockResolvedValue('verification-token');

    await expect(
      service.register({ email: createdUser.email, password: 'password123' }),
    ).resolves.toEqual({ email: createdUser.email });
    expect(events.emit).toHaveBeenCalledWith('user.registered', {
      email: createdUser.email,
      token: 'verification-token',
    });
  });

  it('issues a token pair after successful login', async () => {
    const account = user();
    users.findOneByEmailWithPassword.mockResolvedValue(account);
    compare.mockResolvedValue(true);
    tokens.issueTokenPair.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    await expect(
      service.login({ email: account.email, password: 'password123' }),
    ).resolves.toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    expect(tokens.issueTokenPair).toHaveBeenCalledWith(
      account,
      expect.any(String),
    );
  });

  it('records failed password attempts', async () => {
    const account = user();
    users.findOneByEmailWithPassword.mockResolvedValue(account);
    compare.mockResolvedValue(false);

    await expect(service.validateUser(account.email, 'wrong')).rejects.toEqual(
      new UnauthorizedException('Invalid credentials'),
    );
    expect(users.incrementFailedAttempts).toHaveBeenCalledWith(account.id);
  });

  it('rejects an unverified user after a valid password', async () => {
    const account = user({ isVerified: false });
    users.findOneByEmailWithPassword.mockResolvedValue(account);
    compare.mockResolvedValue(true);

    await expect(
      service.validateUser(account.email, 'password'),
    ).rejects.toEqual(
      new ForbiddenException('Please verify your email to continue'),
    );
  });

  describe('findOrCreateGoogleUser', () => {
    const googleProfile = {
      googleId: 'g-12345',
      email: 'user@example.com',
      name: 'Google User',
      photo: 'https://photo.test/a.jpg',
    };

    it('returns the existing user immediately on repeat Google login', async () => {
      const existing = user({ googleId: 'g-12345' });
      users.findOneByGoogleId.mockResolvedValue(existing);

      await expect(service.findOrCreateGoogleUser(googleProfile)).resolves.toBe(
        existing,
      );
      expect(users.findOneByEmailWithPassword).not.toHaveBeenCalled();
      expect(users.update).not.toHaveBeenCalled();
      expect(users.create).not.toHaveBeenCalled();
    });

    it('links a Google profile to an existing local account', async () => {
      const local = user({
        googleId: undefined,
        password: 'hashed-password',
        emailVerifiedAt: undefined,
      });
      users.findOneByGoogleId.mockResolvedValue(null);
      users.findOneByEmailWithPassword.mockResolvedValue(local);
      users.update.mockResolvedValue({ affected: 1 });
      const updated = user({
        ...local,
        googleId: 'g-12345',
        authProvider: AuthProvider.HYBRID,
      });
      users.findOneById.mockResolvedValue(updated);

      await service.findOrCreateGoogleUser(googleProfile);

      expect(users.update).toHaveBeenCalledWith(local.id, {
        googleId: 'g-12345',
        authProvider: AuthProvider.HYBRID,
        isVerified: true,
        emailVerifiedAt: expect.any(Date) as Date,
      });
    });

    it('links to HYBRID only when a password already exists, otherwise GOOGLE', async () => {
      const passwordless = user({ googleId: undefined, password: null });
      users.findOneByGoogleId.mockResolvedValue(null);
      users.findOneByEmailWithPassword.mockResolvedValue(passwordless);
      users.update.mockResolvedValue({ affected: 1 });
      users.findOneById.mockResolvedValue(passwordless);

      await service.findOrCreateGoogleUser(googleProfile);

      expect(users.update).toHaveBeenCalledWith(
        passwordless.id,
        expect.objectContaining({ authProvider: AuthProvider.GOOGLE }),
      );
    });

    it('creates a new verified Google user when no match exists', async () => {
      users.findOneByGoogleId.mockResolvedValue(null);
      users.findOneByEmailWithPassword.mockResolvedValue(null);
      const created = user({
        id: 'new-user',
        googleId: 'g-12345',
        password: null,
        authProvider: AuthProvider.GOOGLE,
        emailVerifiedAt: new Date(),
      });
      users.create.mockResolvedValue(created);

      await expect(service.findOrCreateGoogleUser(googleProfile)).resolves.toBe(
        created,
      );
      expect(users.create).toHaveBeenCalledWith({
        email: googleProfile.email,
        name: googleProfile.name,
        password: null,
        googleId: googleProfile.googleId,
        authProvider: AuthProvider.GOOGLE,
        isVerified: true,
        emailVerifiedAt: expect.any(Date) as Date,
        profilePicture: googleProfile.photo,
      });
    });

    it('rejects a googleId already linked to a different account', async () => {
      const conflicting = user({ googleId: 'different-google-id' });
      users.findOneByGoogleId.mockResolvedValue(null);
      users.findOneByEmailWithPassword.mockResolvedValue(conflicting);

      await expect(
        service.findOrCreateGoogleUser(googleProfile),
      ).rejects.toThrow(
        'This email is already linked to a different Google account.',
      );
      expect(users.update).not.toHaveBeenCalled();
    });

    it('recovers from a duplicate-key race by returning the winning row', async () => {
      users.findOneByGoogleId
        .mockResolvedValueOnce(null) // first lookup, before create attempt
        .mockResolvedValueOnce(user({ googleId: 'g-12345' })); // re-query after conflict
      users.findOneByEmailWithPassword.mockResolvedValue(null);
      users.create.mockRejectedValue({ code: '23505' });

      const result = await service.findOrCreateGoogleUser(googleProfile);

      expect(result.googleId).toBe('g-12345');
      expect(users.findOneByGoogleId).toHaveBeenCalledTimes(2);
    });

    it('rethrows non-duplicate-key errors from user creation', async () => {
      users.findOneByGoogleId.mockResolvedValue(null);
      users.findOneByEmailWithPassword.mockResolvedValue(null);
      users.create.mockRejectedValue(new Error('connection lost'));

      await expect(
        service.findOrCreateGoogleUser(googleProfile),
      ).rejects.toThrow('connection lost');
    });
  });

  describe('loginWithGoogle', () => {
    it('resolves the user and issues a token pair', async () => {
      const googleProfile = {
        googleId: 'g-12345',
        email: 'user@example.com',
        name: 'Google User',
      };
      const account = user({ googleId: 'g-12345' });
      users.findOneByGoogleId.mockResolvedValue(account);
      tokens.issueTokenPair.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      });

      await expect(service.loginWithGoogle(googleProfile)).resolves.toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
      });
      expect(tokens.issueTokenPair).toHaveBeenCalledWith(
        account,
        expect.any(String),
      );
    });
  });
});
