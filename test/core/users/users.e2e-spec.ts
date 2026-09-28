import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Queue } from 'bullmq';
import type { UUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../../../src/app.module';
import { UserRole } from '../../../src/core/users/enums/user.enum';
import { UsersService } from '../../../src/core/users/services/users.service';
import { EmailService } from '../../../src/infrastructure/email/email.service';
import {
  TokenCapture,
  captureVerificationTokens,
  registerAndVerify,
} from '../helpers/register-and-verify.helper';

describe('UsersController (E2E)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let capture: TokenCapture;

  // The email worker writes to email_logs in the background. Wait for it to
  // finish so it never touches tables mid-truncate or after the app closes.
  const waitForEmailQueueToDrain = async (): Promise<void> => {
    const queue = app.get<Queue>(getQueueToken('email-queue'));
    for (let i = 0; i < 50; i++) {
      const counts = await queue.getJobCounts('active', 'waiting', 'delayed');
      if (counts.active + counts.waiting + counts.delayed === 0) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({
        sendEmail: jest.fn().mockResolvedValue(null),
        sendVerificationEmail: jest.fn().mockResolvedValue(null),
        sendWelcomeEmail: jest.fn().mockResolvedValue(null),
        sendResetEmail: jest.fn().mockResolvedValue(null),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );

    await app.init();

    dataSource = moduleFixture.get(DataSource);
    usersService = moduleFixture.get(UsersService);
    capture = captureVerificationTokens(app);
  });

  beforeEach(async () => {
    await waitForEmailQueueToDrain();
    capture.reset();
    await dataSource.query('TRUNCATE TABLE refresh_tokens CASCADE;');
    await dataSource.query('TRUNCATE TABLE users CASCADE;'); // cascades to email_verification_tokens
    await dataSource.query('TRUNCATE TABLE email_logs;');
  });

  afterAll(async () => {
    await waitForEmailQueueToDrain();
    await app.close();
  });

  describe('GET /auth/admin-test (Guards & Authorization)', () => {
    const regularUserCredentials = {
      email: 'user@example.com',
      password: 'password12345',
    };

    const adminUserCredentials = {
      email: 'admin@example.com',
      password: 'password12345',
    };

    beforeEach(async () => {
      await registerAndVerify(app, capture, regularUserCredentials);
      await registerAndVerify(app, capture, adminUserCredentials);

      const adminUser = await usersService.findOneByEmail(
        adminUserCredentials.email,
      );
      expect(adminUser).toBeDefined();
      await usersService.update(adminUser!.id as UUID, {
        role: UserRole.ADMIN,
      });
    });

    it('should prevent access if no token is provided (JWT Guard)', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/admin-test')
        .expect(401);

      const body = response.body as { message?: string };
      expect(body.message).toBe('Unauthorized');
    });

    it('should prevent access if token is provided but user role is regular (Roles Guard)', async () => {
      // login as the regular user to retrieve their access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(regularUserCredentials)
        .expect(201);

      const loginBody = loginResponse.body as { accessToken?: string };
      const token = loginBody.accessToken;

      // access the admin resource using the regular user's token
      const response = await request(app.getHttpServer())
        .get('/auth/admin-test')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      const body = response.body as { message?: string };
      expect(body.message).toBe(
        'You do not have permission to access this resource.',
      );
    });

    it('should allow access if token belongs to an admin user', async () => {
      // login as the admin user to retrieve their access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(adminUserCredentials)
        .expect(201);

      const loginBody = loginResponse.body as { accessToken?: string };
      const token = loginBody.accessToken;

      // access the admin resource using the admin user's token
      const response = await request(app.getHttpServer())
        .get('/auth/admin-test')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as { message?: string };
      expect(body.message).toBe('You have admin access');
    });
  });
});
