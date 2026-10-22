import { ResendEmailProvider } from './resend-email.provider';

import { ConfigService } from '@nestjs/config';

import { Resend } from 'resend';

import { EmailProviderError } from '../email.error-handler';

const send = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send },
  })),
}));

describe('ResendEmailProvider', () => {
  let provider: ResendEmailProvider;
  let config: { get: jest.Mock };

  const buildProvider = (
    overrides: Record<string, string> = {},
  ): ResendEmailProvider => {
    const values: Record<string, string> = {
      RESEND_API_KEY: 'api-key',
      EMAIL_FROM_NAME: 'TS RBAC Engine',
      EMAIL_FROM_ADDRESS: 'onboarding@resend.dev',
      ...overrides,
    };
    config = {
      get: jest.fn((key: string): string | undefined => values[key]),
    };
    return new ResendEmailProvider(config as unknown as ConfigService);
  };

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ data: { id: 'email-id' }, error: null });
    provider = buildProvider();
  });

  it('initializes Resend with the configured API key', () => {
    expect(Resend).toHaveBeenCalledWith('api-key');
  });

  it('sends an email using the configured sender', async () => {
    const data = { id: 'email-id' };
    send.mockResolvedValue({ data, error: null });

    await expect(
      provider.sendEmail({
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
    provider = buildProvider({ EMAIL_FROM_NAME: '' });

    await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>Body</p>',
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'onboarding@resend.dev' }),
    );
  });

  it('uses a caller-supplied sender', async () => {
    await provider.sendEmail({
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
      provider.sendEmail({
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
      provider.sendEmail({
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
});
