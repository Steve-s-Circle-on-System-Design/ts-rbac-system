import {
  CreatePendingLogParams,
  MarkFailedParams,
  MarkSentParams,
} from './email.interface';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { QueryDeepPartialEntity, Repository, UpdateResult } from 'typeorm';

import { EmailLog, EmailLogStatus } from './entities/email-log.entity';

@Injectable()
export class EmailLogService {
  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
  ) {}

  async createPending(params: CreatePendingLogParams): Promise<EmailLog> {
    const log = this.emailLogRepository.create({
      jobId: params.jobId,
      jobName: params.jobName,
      recipient: params.recipient,
      payloadMetadata: params.payloadMetadata,
      status: EmailLogStatus.PENDING,
      attempts: 1,
    });

    return this.emailLogRepository.save(log);
  }

  async findByJobId(jobId: string): Promise<EmailLog | null> {
    return this.emailLogRepository.findOne({ where: { jobId } });
  }

  async incrementAttempt(jobId: string): Promise<UpdateResult> {
    return this.emailLogRepository
      .createQueryBuilder()
      .update(EmailLog)
      .set({ attempts: () => '"attempts" + 1', status: EmailLogStatus.PENDING })
      .where('jobId = :jobId', { jobId })
      .execute();
  }

  async markSent(jobId: string, params: MarkSentParams): Promise<UpdateResult> {
    return this.emailLogRepository.update(
      { jobId },
      {
        status: EmailLogStatus.SENT,
        providerResponseId: params.providerResponseId,
        sentAt: new Date(),
      },
    );
  }

  async markFailed(
    jobId: string,
    params: MarkFailedParams,
  ): Promise<UpdateResult> {
    return this.emailLogRepository.update({ jobId }, {
      status: EmailLogStatus.FAILED,
      errorMessage: params.errorMessage,
      errorMetadata: params.errorMetadata,
      failedAt: new Date(),
    } as QueryDeepPartialEntity<EmailLog>);
  }
}
