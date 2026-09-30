import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { Queue } from 'bullmq';

@Injectable()
export class EmailQueueErrorHandler implements OnModuleInit {
  private readonly logger = new Logger(EmailQueueErrorHandler.name);

  constructor(@InjectQueue('email-queue') private readonly emailQueue: Queue) {}

  onModuleInit(): void {
    this.emailQueue.on('error', (error) => {
      this.logger.error(`Email queue error: ${error.message}`);
    });
  }
}
