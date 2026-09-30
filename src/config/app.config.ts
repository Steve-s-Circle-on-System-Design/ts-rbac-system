import { registerAs } from '@nestjs/config';

export default registerAs('appConfig', () => ({
  // Auth configurations
  auth: {
    jwtAccessSecret:
      process.env.JWT_ACCESS_SECRET || 'fallback-super-secret-key',
    jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    jwtRefreshSecret:
      process.env.JWT_REFRESH_SECRET || 'fallback-super-refresh-secret-key',
    jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    refreshTokenHashSecret:
      process.env.REFRESH_TOKEN_HASH_SECRET || 'fallback-hash-secret-key',
    jwtVerificationSecret: process.env.JWT_VERIFICATION_SECRET,
    jwtResetSecret: process.env.JWT_RESET_SECRET,
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    lockoutMaxAttempts: parseInt(
      process.env.AUTH_LOCKOUT_MAX_ATTEMPTS || '5',
      10,
    ),
    lockoutDurationSeconds: parseInt(
      process.env.AUTH_LOCKOUT_DURATION_SECONDS || '900',
      10,
    ),
  },

  // Email configurations
  email: {
    provider: process.env.EMAIL_PROVIDER || 'resend',
    fromName: process.env.EMAIL_FROM_NAME || 'TS RBAC Engine',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev',
    resendApiKey: process.env.RESEND_API_KEY,
    retryAttempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS || '3', 10),
    retryInitialDelayMs: parseInt(
      process.env.EMAIL_RETRY_INITIAL_DELAY_MS || '10000',
      10,
    ),
  },

  // Object Store Configuration (e.g S3, Cloudinary, etc)

  // Google configuration
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:3000/auth/google/callback',
  },

  // Frontendurl Configuration
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
}));
