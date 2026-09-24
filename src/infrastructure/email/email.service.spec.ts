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

  beforeEach(() => {
    send.mockReset();
    config = {
      get: jest.fn((key: string): string | undefined => {
        const values: Record<string, string> = {
          RESEND_API_KEY: 'api-key',
          'appConfig.frontendUrl': 'https://example.test',
          EMAIL_FROM_NAME: 'TS RBAC Engine',
          EMAIL_FROM_ADDRESS: 'onboarding@resend.dev',
        };
        return values[key];
      }),
    };
    service = new EmailService(config as unknown as ConfigService);
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

  it('uses a caller-supplied sender', async () => {
    send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

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

  it('throws an EmailProviderError with metadata when the provider returns an error', async () => {
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

  it('builds the verification link and sends it', async () => {
    send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

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
    send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

    await service.sendResetEmail('user@example.com', 'token-value');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Reset your Password',
        html: expect.stringContaining('token=token-value') as string,
      }),
    );
  });
});
