import { EmailProviderError } from './email.error-handler';
import { SendEmailParams } from './email.interface';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CreateEmailResponseSuccess, Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  private getDefaultFrom(): string {
    const name = this.configService.get<string>('EMAIL_FROM_NAME');
    const address = this.configService.get<string>('EMAIL_FROM_ADDRESS');
    return name && address
      ? `${name} <${address}>`
      : (address ?? 'onboarding@resend.dev');
  }

  async sendEmail(
    params: SendEmailParams,
  ): Promise<CreateEmailResponseSuccess | null> {
    const { data, error } = await this.resend.emails.send({
      from: params.from ?? this.getDefaultFrom(),
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw new EmailProviderError(error.message, {
        ...error,
      });
    }
    return data;
  }

  async sendResetEmail(
    to: string,
    token: string,
  ): Promise<CreateEmailResponseSuccess | null> {
    const resetLink = `${this.configService.get<string>('appConfig.frontendUrl')}/auth/reset-password?token=${token}`;
    return this.sendEmail({
      to,
      subject: 'Reset your Password',
      html: `<p>Please click the following link to reset your password: <a href="${resetLink}">Reset Password</a></p>`,
    });
  }

  async sendVerificationEmail(
    to: string,
    token: string,
  ): Promise<CreateEmailResponseSuccess | null> {
    const verificationLink = `${this.configService.get<string>('appConfig.frontendUrl')}/auth/verify-email?token=${token}`;
    return this.sendEmail({
      to,
      subject: 'Verify your email',
      html: `<p>Please click the following link to verify your email: <a href="${verificationLink}">Verify Email</a></p>`,
    });
  }

  async sendMagicOtpEmail(
    to: string,
    otpCode: string,
  ): Promise<CreateEmailResponseSuccess | null> {
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
  ): Promise<CreateEmailResponseSuccess | null> {
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
