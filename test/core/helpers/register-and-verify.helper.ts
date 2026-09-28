import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import request from 'supertest';

export interface TokenCapture {
  tokens: Record<string, string>;
  reset: () => void;
}

/** Listens for user.registered and records the raw token per email. */
export function captureVerificationTokens(app: INestApplication): TokenCapture {
  const capture: TokenCapture = {
    tokens: {},
    reset: () => {
      capture.tokens = {};
    },
  };

  app
    .get(EventEmitter2)
    .on('user.registered', (payload: { email: string; token: string }) => {
      capture.tokens[payload.email] = payload.token;
    });

  return capture;
}

export async function registerAndVerify(
  app: INestApplication,
  capture: TokenCapture,
  credentials: { email: string; password: string },
): Promise<void> {
  const server = app.getHttpServer() as Parameters<typeof request>[0];

  await request(server)
    .post('/auth/register')
    .send(credentials)
    .expect(201)
    .expect({ message: 'Sign Up successful, verify Email.' });

  const token = capture.tokens[credentials.email];
  expect(token).toEqual(expect.any(String));

  await request(server)
    .get('/auth/verify-email')
    .query({ token })
    .expect(200)
    .expect({ verified: true });
}
