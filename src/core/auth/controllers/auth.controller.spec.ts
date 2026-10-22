import { AuthController, RequestWithGoogleUser } from './auth.controller';

import { AuthService } from '../services/auth.service';
import { EmailVerificationService } from '../services/email-verification.service';
import { PasswordResetService } from '../services/password-reset.service';
import { TokenService } from '../services/token.service';

describe('AuthController', () => {
  let controller: AuthController;
  const auth = {
    login: jest.fn(),
    register: jest.fn(),
    loginWithGoogle: jest.fn(),
  };
  const tokens = { refreshTokens: jest.fn(), logout: jest.fn() };
  const verification = { verifyEmail: jest.fn() };
  const passwordReset = {
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new AuthController(
      auth as unknown as AuthService,
      tokens as unknown as TokenService,
      verification as unknown as EmailVerificationService,
      passwordReset as unknown as PasswordResetService,
    );
  });

  it('delegates login and registration to AuthService', async () => {
    const dto = { email: 'user@example.com', password: 'password123' };
    auth.login.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    auth.register.mockResolvedValue({ id: 'user-id', email: dto.email });

    await expect(controller.login(dto)).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    await expect(controller.register(dto)).resolves.toEqual({
      message: 'Sign Up successful, verify Email.',
    });
  });

  it('delegates verification and token lifecycle operations', async () => {
    verification.verifyEmail.mockResolvedValue({ verified: true });
    tokens.refreshTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    tokens.logout.mockResolvedValue({ message: 'Logged out successfully' });

    await expect(controller.verifyEmail('token')).resolves.toEqual({
      verified: true,
    });
    await expect(
      controller.refresh({ refreshToken: 'refresh' }),
    ).resolves.toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    await expect(
      controller.logout({ refreshToken: 'refresh' }),
    ).resolves.toEqual({ message: 'Logged out successfully' });
  });

  it('delegates password-reset operations', async () => {
    passwordReset.forgotPassword.mockResolvedValue(undefined);
    passwordReset.resetPassword.mockResolvedValue({
      message: 'Password has been reset successfully.',
    });

    await expect(
      controller.forgotPassword({ email: 'user@example.com' }),
    ).resolves.toEqual({
      message:
        'If an account with that email exists, a password reset link has been sent.',
    });
    expect(passwordReset.forgotPassword).toHaveBeenCalledWith(
      'user@example.com',
    );
    await expect(
      controller.resetPassword({ newPassword: 'password123' }, 'token'),
    ).resolves.toEqual({
      message: 'Your password has been reset successfully.',
    });
  });

  it('delegates the Google OAuth callback to AuthService', async () => {
    const googleProfile = {
      googleId: 'g-12345',
      email: 'user@example.com',
      name: 'Google User',
    };
    auth.loginWithGoogle.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const req = { user: googleProfile } as RequestWithGoogleUser;

    await expect(controller.googleAuthCallback(req)).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(auth.loginWithGoogle).toHaveBeenCalledWith(googleProfile);
  });

  it('googleAuth performs no logic — the guard handles the redirect', () => {
    expect(controller.googleAuth()).toBeUndefined();
  });
});
