import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { Queue } from 'bullmq';

import { SendVerificationEmailPayload } from '../dto/verification-email.dto';

@Injectable()
export class AuthListener {
  private readonly logger = new Logger(AuthListener.name);

  constructor(@InjectQueue('email-queue') private readonly emailQueue: Queue) {}

  @OnEvent('user.registered')
  async queueVerificationEmail(
    payload: SendVerificationEmailPayload,
  ): Promise<void> {
    this.logger.log(
      `queueVerificationEmail called: ${JSON.stringify(payload)}`,
    );
    const { token, email } = payload;

    await this.emailQueue.add('email-verification', {
      jobName: 'email-verification',
      email,
      token,
    });
  }

  @OnEvent('user.verified')
  async queueWelcomeEmail(payload: { email: string }): Promise<void> {
    this.logger.log(`Welcome email queued for ${payload.email}`);

    await this.emailQueue.add('welcome-email', {
      jobName: 'welcome-email',
      email: payload.email,
    });
  }

  @OnEvent('user.forgot-password')
  async queuePasswordResetEmail(payload: {
    email: string;
    token: string;
  }): Promise<void> {
    this.logger.log(`Reset password queued for ${payload.email}`);
    const { email, token } = payload;

    await this.emailQueue.add('password-reset', {
      jobName: 'password-reset',
      email,
      token,
    });
  }
}
