import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { Queue } from 'bullmq';

import { SendVerificationEmailPayload } from './dto/verification-email.dto';

@Injectable()
export class AuthListener {
  private readonly logger = new Logger(AuthListener.name);

  constructor(
    @InjectQueue('email')
    private readonly emailQueue: Queue,
  ) {}

  @OnEvent('user.registered')
  async queueVerificationEmail(
    payload: SendVerificationEmailPayload,
  ): Promise<void> {
    this.logger.log(
      `queueVerificationEmail called: ${JSON.stringify(payload)}`,
    );

    const { token, email } = payload;

    await this.emailQueue.add(
      'send-verification',
      {
        email,
        token,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
