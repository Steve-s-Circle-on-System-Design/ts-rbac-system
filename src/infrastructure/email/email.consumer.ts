import { EmailLogService } from './email-log.service';
import { EmailProviderError } from './email.error-handler';
import { EmailService } from './email.service';

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { Job } from 'bullmq';
import { CreateEmailResponseSuccess } from 'resend';

import { EmailJobData } from '../queue/queue.interface';

@Processor('email-queue')
export class EmailConsumer extends WorkerHost {
  private readonly logger = new Logger(EmailConsumer.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly emailLogService: EmailLogService,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const jobId = job.id;

    if (!jobId) {
      throw new Error(`Job is missing an id, cannot process: ${job.name}`);
    }

    this.logger.log(`Processing job ${jobId} → ${job.name}`);

    await this.ensureLogExists(jobId, job.data);

    try {
      const response = await this.dispatch(job.name, job.data);
      await this.emailLogService.markSent(jobId, {
        providerResponseId: response?.id,
      });
    } catch (error: unknown) {
      await this.recordFailure(jobId, error);
      throw error;
    }
  }

  private async ensureLogExists(
    jobId: string,
    data: EmailJobData,
  ): Promise<void> {
    const existing = await this.emailLogService.findByJobId(jobId);

    if (!existing) {
      await this.emailLogService.createPending({
        jobId,
        jobName: data.jobName,
        recipient: data.email,
        payloadMetadata: this.buildSafeMetadata(data),
      });
      return;
    }

    const result = await this.emailLogService.incrementAttempt(jobId);
    if (!result.affected) {
      this.logger.warn(
        `Expected an existing email_logs row for job ${jobId} but none was updated`,
      );
    }
  }

  private async dispatch(
    jobName: string,
    data: EmailJobData,
  ): Promise<CreateEmailResponseSuccess | null> {
    switch (data.jobName) {
      case 'email-verification':
        return this.emailService.sendVerificationEmail(data.email, data.token);
      case 'password-reset':
        return this.emailService.sendResetEmail(data.email, data.token);
      case 'magic-otp':
        return this.emailService.sendMagicOtpEmail(data.email, data.otpCode);
      case 'security-alert':
        return this.emailService.sendSecurityAlertEmail(
          data.email,
          data.event,
          data.metadata,
        );
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  private async recordFailure(jobId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    const providerMetadata =
      error instanceof EmailProviderError ? error.metadata : undefined;

    const result = await this.emailLogService.markFailed(jobId, {
      errorMessage: message,
      errorMetadata: {
        stack,
        ...(providerMetadata ?? {}),
      },
    });

    if (!result.affected) {
      this.logger.warn(
        `Expected an existing email_logs row for job ${jobId} but none was updated on failure`,
      );
    }
  }

  private buildSafeMetadata(data: EmailJobData): Record<string, unknown> {
    const base: Record<string, unknown> = {
      jobName: data.jobName,
      email: data.email,
      correlationId: data.correlationId,
    };

    if (data.jobName === 'magic-otp' || data.jobName === 'security-alert') {
      base.userId = data.userId;
    }
    if (data.jobName === 'security-alert') {
      base.event = data.event;
    }

    return base;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error(`Worker error: ${error.message}`, error.stack);
  }
}
