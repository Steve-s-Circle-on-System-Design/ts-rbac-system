import { Injectable, Logger } from '@nestjs/common';

import { EmailSendResult, IEmailProvider } from '../email-provider.interface';
import { SendEmailParams } from '../email.interface';

@Injectable()
export class MockEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(MockEmailProvider.name);

  sendEmail(params: SendEmailParams): Promise<EmailSendResult | null> {
    this.logger.log(
      `[MOCK EMAIL] To: ${Array.isArray(params.to) ? params.to.join(', ') : params.to} | Subject: ${params.subject}`,
    );
    return Promise.resolve({ id: 'mock-email-id' });
  }
}
