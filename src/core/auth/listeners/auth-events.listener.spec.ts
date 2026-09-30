import { AuthListener } from './auth-events.listener';

import { Queue } from 'bullmq';

describe('AuthListener', () => {
  it('queues verification email jobs onto email-queue without per-job retry options', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'job-id' });
    const emailQueue = { add } as unknown as Queue;
    const authQueue = { add: jest.fn() } as unknown as Queue;
    const listener = new AuthListener(emailQueue, authQueue);
    const payload = { email: 'user@example.com', token: 'token-value' };

    await listener.queueVerificationEmail(payload);

    expect(add).toHaveBeenCalledWith('email-verification', {
      jobName: 'email-verification',
      email: 'user@example.com',
      token: 'token-value',
    });
  });

  it('queues password-reset email jobs with the new job name', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'job-id' });
    const emailQueue = { add } as unknown as Queue;
    const authQueue = { add: jest.fn() } as unknown as Queue;
    const listener = new AuthListener(emailQueue, authQueue);

    await listener.queuePasswordResetEmail({
      email: 'user@example.com',
      token: 'token-value',
    });

    expect(add).toHaveBeenCalledWith('password-reset', {
      jobName: 'password-reset',
      email: 'user@example.com',
      token: 'token-value',
    });
  });

  it('propagates queue failures so the event emitter can report them', async () => {
    const add = jest.fn().mockRejectedValue(new Error('Redis unavailable'));
    const emailQueue = { add } as unknown as Queue;
    const authQueue = { add: jest.fn() } as unknown as Queue;
    const listener = new AuthListener(emailQueue, authQueue);

    await expect(
      listener.queueVerificationEmail({
        email: 'user@example.com',
        token: 'token-value',
      }),
    ).rejects.toThrow('Redis unavailable');
  });
});
