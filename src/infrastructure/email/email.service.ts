import {
  EMAIL_PROVIDER,
  EmailSendResult,
  type IEmailProvider,
} from './email-provider.interface';
import { SendEmailParams } from './email.interface';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
    private readonly configService: ConfigService,
  ) {}

  private getFrontendUrl(): string {
    return this.configService.get<string>('appConfig.frontendUrl') ?? '';
  }

  async sendEmail(params: SendEmailParams): Promise<EmailSendResult | null> {
    return this.emailProvider.sendEmail(params);
  }

  async sendVerificationEmail(
    to: string,
    token: string,
  ): Promise<EmailSendResult | null> {
    const link = `${this.getFrontendUrl()}/auth/verify-email?token=${token}`;
    return this.sendEmail({
      to,
      subject: 'Verify your email',
      html: `<p>Please click the following link to verify your email: <a href="${link}">Verify Email</a></p>`,
    });
  }

  async sendResetEmail(
    to: string,
    token: string,
  ): Promise<EmailSendResult | null> {
    const link = `${this.getFrontendUrl()}/auth/reset-password?token=${token}`;
    return this.sendEmail({
      to,
      subject: 'Reset your Password',
      html: `<p>Please click the following link to reset your password: <a href="${link}">Reset Password</a></p>`,
    });
  }

  async sendWelcomeEmail(to: string): Promise<EmailSendResult | null> {
    return this.sendEmail({
      to,
      subject: 'Welcome!',
      html: '<p>Welcome aboard — your account is now active.</p>',
    });
  }

  async sendMagicOtpEmail(
    to: string,
    otpCode: string,
  ): Promise<EmailSendResult | null> {
    return this.sendEmail({
      to,
      subject: 'Your one-time login code',
      html: `<p>Your one-time code is: <strong>${otpCode}</strong></p><p>This code will expire shortly. If you did not request this, you can ignore this email.</p>`,
    });
  }

  async sendSecurityAlertEmail(
    to: string,
    event: string,
    metadata?: Record<string, unknown>,
  ): Promise<EmailSendResult | null> {
    const details = metadata
      ? `<p>Details: ${JSON.stringify(metadata)}</p>`
      : '';
    return this.sendEmail({
      to,
      subject: 'Security alert on your account',
      html: `<p>We detected the following activity on your account: <strong>${event}</strong></p>${details}<p>If this wasn't you, please secure your account immediately.</p>`,
    });
  }
}
