import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { Job } from 'bullmq';

// import { SendVerificationEmailPayload } from '../../auth/dto/verification-email.dto';
import { EmailJobData } from '../../email/email.interface';
import { EmailService } from '../../email/email.service';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly emailService: EmailService;

  constructor(emailService: EmailService) {
    super();
    this.emailService = emailService;
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    this.logger.log(`Processing job ${job.id} → ${job.name}`);

    switch (job.name) {
      case 'send-verification':
        await this.emailService.sendVerificationEmail(
          job.data.email,
          job.data.token,
        );
        break;
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  }

  // private async sendVerificationEmail(data: SendVerificationEmailPayload) {
  //   const { email, token } = data;
  //   // your email logic
  //   this.logger.log(`Welcome email sent to ${data.email}`);
  // }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<EmailJobData>): void {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailJobData>, error: Error): void {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
