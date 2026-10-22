import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Resend } from 'resend';

import { EmailSendResult, IEmailProvider } from '../email-provider.interface';
import { EmailProviderError } from '../email.error-handler';
import { SendEmailParams } from '../email.interface';

@Injectable()
export class ResendEmailProvider implements IEmailProvider {
  private readonly resend: Resend;
  private readonly logger = new Logger(ResendEmailProvider.name);

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

  async sendEmail(params: SendEmailParams): Promise<EmailSendResult | null> {
    const { data, error } = await this.resend.emails.send({
      from: params.from ?? this.getDefaultFrom(),
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw new EmailProviderError(error.message, { ...error });
    }

    return data;
  }
}
