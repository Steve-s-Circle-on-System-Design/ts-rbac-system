import { EmailProviderError } from './email.error-handler';
import { EmailService } from './email.service';

import { ConfigService } from '@nestjs/config';

import { Resend } from 'resend';

const send = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;
  let config: { get: jest.Mock };

  const buildService = (
    overrides: Record<string, string> = {},
  ): EmailService => {
    const values: Record<string, string> = {
      RESEND_API_KEY: 'api-key',
      'appConfig.frontendUrl': 'https://example.test',
      EMAIL_FROM_NAME: 'TS RBAC Engine',
      EMAIL_FROM_ADDRESS: 'onboarding@resend.dev',
      ...overrides,
    };
    config = {
      get: jest.fn((key: string): string | undefined => values[key]),
    };
    return new EmailService(config as unknown as ConfigService);
  };

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ data: { id: 'email-id' }, error: null });
    service = buildService();
  });

  it('initializes Resend with the configured API key', () => {
    expect(Resend).toHaveBeenCalledWith('api-key');
  });

  it('sends an email using the configured sender', async () => {
    const data = { id: 'email-id' };
    send.mockResolvedValue({ data, error: null });

    await expect(
      service.sendEmail({
        to: 'user@example.com',
        subject: 'Subject',
        html: '<p>Body</p>',
      }),
    ).resolves.toEqual(data);

    expect(send).toHaveBeenCalledWith({
      from: 'TS RBAC Engine <onboarding@resend.dev>',
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>Body</p>',
    });
  });

  it('falls back to the address alone when no sender name is configured', async () => {
    service = buildService({ EMAIL_FROM_NAME: '' });

    await service.sendEmail({
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>Body</p>',
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'onboarding@resend.dev' }),
    );
  });

  it('uses a caller-supplied sender', async () => {
    await service.sendEmail({
      from: 'Support <support@example.com>',
      to: ['one@example.com', 'two@example.com'],
      subject: 'Subject',
      html: '<p>Body</p>',
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Support <support@example.com>',
        to: ['one@example.com', 'two@example.com'],
      }),
    );
  });

  it('throws an EmailProviderError when the provider returns an error', async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'Provider failed' },
    });

    await expect(
      service.sendEmail({
        to: 'user@example.com',
        subject: 'Subject',
        html: '<p>Body</p>',
      }),
    ).rejects.toThrow(EmailProviderError);
  });

  it('preserves provider error details as metadata', async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: 'rate_limit_exceeded', message: 'Too many requests' },
    });

    await expect(
      service.sendEmail({
        to: 'user@example.com',
        subject: 'Subject',
        html: '<p>Body</p>',
      }),
    ).rejects.toMatchObject({
      message: 'Too many requests',
      metadata: expect.objectContaining({
        name: 'rate_limit_exceeded',
      }) as Record<string, unknown>,
    });
  });

  it('builds the verification link and sends it', async () => {
    await service.sendVerificationEmail('user@example.com', 'token-value');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Verify your email',
        html: expect.stringContaining(
          'https://example.test/auth/verify-email?token=token-value',
        ) as string,
      }),
    );
  });

  it('sends a password-reset email', async () => {
    await service.sendResetEmail('user@example.com', 'token-value');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Reset your Password',
        html: expect.stringContaining(
          'https://example.test/auth/reset-password?token=token-value',
        ) as string,
      }),
    );
  });

  it('returns the provider response so callers can log its id', async () => {
    await expect(service.sendWelcomeEmail('user@example.com')).resolves.toEqual(
      { id: 'email-id' },
    );
  });

  it('sends a welcome email', async () => {
    await service.sendWelcomeEmail('user@example.com');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Welcome!',
      }),
    );
  });

  it('sends a magic OTP email containing the code', async () => {
    await service.sendMagicOtpEmail('user@example.com', '123456');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Your one-time login code',
        html: expect.stringContaining('123456') as string,
      }),
    );
  });

  it('sends a security-alert email with event and metadata', async () => {
    await service.sendSecurityAlertEmail(
      'user@example.com',
      'new-device-login',
      {
        ip: '1.2.3.4',
      },
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Security alert on your account',
        html: expect.stringContaining('new-device-login') as string,
      }),
    );
    const html = (send.mock.calls[0] as [{ html: string }])[0].html;
    expect(html).toContain('1.2.3.4');
  });
});
