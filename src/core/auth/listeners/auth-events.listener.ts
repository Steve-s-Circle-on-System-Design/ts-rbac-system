import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { Queue } from 'bullmq';

import { SendVerificationEmailPayload } from '../dto/verification-email.dto';

@Injectable()
export class AuthListener {
  private readonly logger = new Logger(AuthListener.name);

  constructor(
    @InjectQueue('email-queue') private readonly emailQueue: Queue,
    @InjectQueue('auth') private readonly authQueue: Queue,
  ) {}
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

  @OnEvent('user.forgot-password')
  async queuePasswordResetEmail(payload: {
    email: string;
    token: string;
  }): Promise<void> {
    this.logger.log(`Reset password queued`);
    const { email, token } = payload;

    await this.emailQueue.add('password-reset', {
      jobName: 'password-reset',
      email,
      token,
    });
  }

  @OnEvent('user.reset-password-process')
  async queueResetProcess(email: string): Promise<void> {
    this.logger.log(`Reset password process queued`);

    await this.authQueue.add(
      'reset-password',
      { email },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
