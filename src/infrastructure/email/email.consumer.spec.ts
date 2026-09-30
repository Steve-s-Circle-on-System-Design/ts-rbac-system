import { EmailLogService } from './email-log.service';
import { EmailConsumer } from './email.consumer';
import { EmailService } from './email.service';

import { Job } from 'bullmq';

import { EmailJobData } from '../queue/queue.interface';

describe('EmailConsumer', () => {
  let sendVerificationEmail: jest.Mock;
  let sendResetEmail: jest.Mock;
  let sendMagicOtpEmail: jest.Mock;
  let sendSecurityAlertEmail: jest.Mock;
  let findByJobId: jest.Mock;
  let createPending: jest.Mock;
  let incrementAttempt: jest.Mock;
  let markSent: jest.Mock;
  let markFailed: jest.Mock;
  let consumer: EmailConsumer;

  const asJob = (job: {
    id: string;
    name: string;
    data: EmailJobData;
  }): Job<EmailJobData> => job as unknown as Job<EmailJobData>;

  beforeEach(() => {
    sendVerificationEmail = jest.fn().mockResolvedValue({ id: 'provider-id' });
    sendResetEmail = jest.fn().mockResolvedValue({ id: 'provider-id' });
    sendMagicOtpEmail = jest.fn().mockResolvedValue({ id: 'provider-id' });
    sendSecurityAlertEmail = jest.fn().mockResolvedValue({ id: 'provider-id' });

    findByJobId = jest.fn().mockResolvedValue(null);
    createPending = jest.fn().mockResolvedValue(undefined);
    incrementAttempt = jest.fn().mockResolvedValue({ affected: 1 });
    markSent = jest.fn().mockResolvedValue({ affected: 1 });
    markFailed = jest.fn().mockResolvedValue({ affected: 1 });

    consumer = new EmailConsumer(
      {
        sendVerificationEmail,
        sendResetEmail,
        sendMagicOtpEmail,
        sendSecurityAlertEmail,
      } as unknown as EmailService,
      {
        findByJobId,
        createPending,
        incrementAttempt,
        markSent,
        markFailed,
      } as unknown as EmailLogService,
    );
  });

  it('processes email-verification jobs and marks the log SENT', async () => {
    const job = asJob({
      id: 'job-1',
      name: 'email-verification',
      data: {
        jobName: 'email-verification',
        email: 'user@example.com',
        token: 'tok',
      },
    });

    await consumer.process(job);

    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        jobName: 'email-verification',
      }),
    );
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      'user@example.com',
      'tok',
    );
    expect(markSent).toHaveBeenCalledWith('job-1', {
      providerResponseId: 'provider-id',
    });
  });

  it('processes magic-otp jobs', async () => {
    const job = asJob({
      id: 'job-2',
      name: 'magic-otp',
      data: {
        jobName: 'magic-otp',
        email: 'user@example.com',
        otpCode: '123456',
        userId: 'u1',
      },
    });

    await consumer.process(job);

    expect(sendMagicOtpEmail).toHaveBeenCalledWith(
      'user@example.com',
      '123456',
    );
    expect(markSent).toHaveBeenCalled();
  });

  it('processes password-reset jobs', async () => {
    const job = asJob({
      id: 'job-3',
      name: 'password-reset',
      data: {
        jobName: 'password-reset',
        email: 'user@example.com',
        token: 'tok',
      },
    });

    await consumer.process(job);

    expect(sendResetEmail).toHaveBeenCalledWith('user@example.com', 'tok');
    expect(markSent).toHaveBeenCalled();
  });

  it('processes security-alert jobs', async () => {
    const job = asJob({
      id: 'job-4',
      name: 'security-alert',
      data: {
        jobName: 'security-alert',
        email: 'user@example.com',
        userId: 'u1',
        event: 'new-device-login',
      },
    });

    await consumer.process(job);

    expect(sendSecurityAlertEmail).toHaveBeenCalledWith(
      'user@example.com',
      'new-device-login',
      undefined,
    );
    expect(markSent).toHaveBeenCalled();
  });

  it('rejects unknown job names', async () => {
    const job = {
      id: 'job-5',
      name: 'unknown-job',
      data: { jobName: 'unknown-job', email: 'user@example.com' },
    } as unknown as Job<EmailJobData>;

    await expect(consumer.process(job)).rejects.toThrow();
  });

  it('increments attempt count when a log already exists', async () => {
    findByJobId.mockResolvedValue({ id: 'log-id', jobId: 'job-6' });

    const job = asJob({
      id: 'job-6',
      name: 'email-verification',
      data: {
        jobName: 'email-verification',
        email: 'user@example.com',
        token: 'tok',
      },
    });

    await consumer.process(job);

    expect(createPending).not.toHaveBeenCalled();
    expect(incrementAttempt).toHaveBeenCalledWith('job-6');
  });
});
