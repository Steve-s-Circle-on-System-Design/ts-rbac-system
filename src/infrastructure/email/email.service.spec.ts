import { EmailSendResult, IEmailProvider } from './email-provider.interface';
import { EmailService } from './email.service';

import { ConfigService } from '@nestjs/config';

describe('EmailService', () => {
  let service: EmailService;
  const sendEmail = jest.fn();
  let config: { get: jest.Mock };

  beforeEach(() => {
    sendEmail.mockReset();
    config = {
      get: jest.fn((key: string): string | undefined => {
        if (key === 'appConfig.frontendUrl') {
          return 'https://example.test';
        }
        return undefined;
      }),
    };

    const mockProvider: IEmailProvider = {
      sendEmail: sendEmail as (
        params: unknown,
      ) => Promise<EmailSendResult | null>,
    };

    service = new EmailService(
      mockProvider,
      config as unknown as ConfigService,
    );
  });

  it('delegates sendEmail to the injected provider', async () => {
    const data: EmailSendResult = { id: 'email-id' };
    sendEmail.mockResolvedValue(data);

    const params = {
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    };

    const result = await service.sendEmail(params);

    expect(sendEmail).toHaveBeenCalledWith(params);
    expect(result).toEqual(data);
  });

  it('builds the verification link and sends it', async () => {
    sendEmail.mockResolvedValue({ id: 'email-id' });

    await service.sendVerificationEmail('user@example.com', 'token-value');

    expect(sendEmail).toHaveBeenCalledWith(
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
    sendEmail.mockResolvedValue({ id: 'email-id' });

    await service.sendResetEmail('user@example.com', 'token-value');

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Reset your Password',
        html: expect.stringContaining(
          'https://example.test/auth/reset-password?token=token-value',
        ) as string,
      }),
    );
  });

  it('sends a welcome email', async () => {
    sendEmail.mockResolvedValue({ id: 'email-id' });

    await service.sendWelcomeEmail('user@example.com');

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Welcome!',
      }),
    );
  });

  it('sends a magic OTP email containing the code', async () => {
    sendEmail.mockResolvedValue({ id: 'email-id' });

    await service.sendMagicOtpEmail('user@example.com', '123456');

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Your one-time login code',
        html: expect.stringContaining('123456') as string,
      }),
    );
  });

  it('sends a security-alert email with event and metadata', async () => {
    sendEmail.mockResolvedValue({ id: 'email-id' });

    await service.sendSecurityAlertEmail(
      'user@example.com',
      'new-device-login',
      { ip: '1.2.3.4' },
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Security alert on your account',
        html: expect.stringMatching(/new-device-login.*1\.2\.3\.4/s) as string,
      }),
    );
  });
});
