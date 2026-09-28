import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../../../src/app.module';
import { UsersService } from '../../../src/core/users/services/users.service';
import { EmailService } from '../../../src/infrastructure/email/email.service';
import {
  TokenCapture,
  captureVerificationTokens,
  registerAndVerify,
} from '../helpers/register-and-verify.helper';

describe('AuthController (E2E)', () => {
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

  describe('POST /auth/register', () => {
    const registerDto = {
      email: 'testuser@example.com',
      password: 'strongPassword123',
    };

    it('registers a new user as pending, without exposing user metadata', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toEqual({
        message: 'Sign Up successful, verify Email.',
      });
      expect(response.body).not.toHaveProperty('id');
      expect(response.body).not.toHaveProperty('password');

      const registeredUser = await usersService.findOneByEmail(
        registerDto.email,
      );
      expect(registeredUser).toEqual(
        expect.objectContaining({
          email: registerDto.email,
          isVerified: false,
        }),
      );
    });

    it('treats a repeat registration of an unverified email as a resend', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);
      const firstToken = capture.tokens[registerDto.email];

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);
      const secondToken = capture.tokens[registerDto.email];

      expect(secondToken).not.toBe(firstToken);

      // The old link is dead; only the newest one works.
      await request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ token: firstToken })
        .expect(400);
      await request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ token: secondToken })
        .expect(200);
    });

    it('should fail with a 400 bad request if the email is already verified', async () => {
      await registerAndVerify(app, capture, registerDto);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);

      const body = response.body as { message?: string };
      expect(body.message).toBe('Email is already registered');
    });

    it('rejects a verification token that was already used', async () => {
      await registerAndVerify(app, capture, registerDto);

      await request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ token: capture.tokens[registerDto.email] })
        .expect(400);
    });

    it('should fail if email validation fails', async () => {
      const invalidDto = {
        email: 'not-an-email', // should match email format
        password: 'strongPassword123',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);
    });

    it('should fail if password validation fails (too short)', async () => {
      const invalidDto = {
        email: 'testuser@example.com',
        password: '123', // minimum for a password should be 8 chars
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    const userCredentials = {
      email: 'loginuser@example.com',
      password: 'password12345',
    };

    beforeEach(async () => {
      await registerAndVerify(app, capture, userCredentials);
    });

    it('should login successfully and return an access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userCredentials)
        .expect(201);

      const body = response.body as { accessToken?: string };
      expect(body.accessToken).toBeDefined();
      expect(typeof body.accessToken).toBe('string');
    });

    it('should reject login if credentials are invalid (wrong password)', async () => {
      const wrongCredentials = {
        email: userCredentials.email,
        password: 'incorrectPassword',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(wrongCredentials)
        .expect(401);

      const body = response.body as { message?: string };
      expect(body.message).toBe('Invalid credentials');
    });

    it('should reject login if email does not exist', async () => {
      const nonexistentCredentials = {
        email: 'nonexistent@example.com',
        password: 'somePassword',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(nonexistentCredentials)
        .expect(401);

      const body = response.body as { message?: string };
      expect(body.message).toBe('Invalid credentials');
    });
  });
});
