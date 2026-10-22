import { SendEmailParams } from './email.interface';

export interface EmailSendResult {
  id?: string;
}

export interface IEmailProvider {
  sendEmail(params: SendEmailParams): Promise<EmailSendResult | null>;
}

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
