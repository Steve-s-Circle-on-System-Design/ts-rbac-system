import { AuthListener } from './auth-events.listener';

import { Queue } from 'bullmq';

describe('AuthListener', () => {
  let add: jest.Mock;
  let emailQueue: Queue;
  let listener: AuthListener;

  beforeEach(() => {
    add = jest.fn().mockResolvedValue({ id: 'job-id' });
    emailQueue = { add } as unknown as Queue;
    listener = new AuthListener(emailQueue);
  });

  it('queues verification email jobs onto email-queue', async () => {
    const payload = { email: 'user@example.com', token: 'token-value' };

    await listener.queueVerificationEmail(payload);

    expect(add).toHaveBeenCalledWith('email-verification', {
      jobName: 'email-verification',
      email: 'user@example.com',
      token: 'token-value',
    });
  });

  it('queues welcome email jobs onto email-queue', async () => {
    const payload = { email: 'user@example.com' };

    await listener.queueWelcomeEmail(payload);

    expect(add).toHaveBeenCalledWith('welcome-email', {
      jobName: 'welcome-email',
      email: 'user@example.com',
    });
  });

  it('queues password-reset email jobs onto email-queue directly', async () => {
    const payload = { email: 'user@example.com', token: 'token-value' };

    await listener.queuePasswordResetEmail(payload);

    expect(add).toHaveBeenCalledWith('password-reset', {
      jobName: 'password-reset',
      email: 'user@example.com',
      token: 'token-value',
    });
  });

  it('propagates queue failures so the event emitter can report them', async () => {
    add.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      listener.queueVerificationEmail({
        email: 'user@example.com',
        token: 'token-value',
      }),
    ).rejects.toThrow('Redis unavailable');
  });
});
