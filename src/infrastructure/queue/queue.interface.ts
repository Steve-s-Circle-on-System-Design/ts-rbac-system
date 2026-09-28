export interface EmailVerificationJobData {
  jobName: 'email-verification';
  email: string;
  token: string;
  correlationId?: string;
}

export interface MagicOtpJobData {
  jobName: 'magic-otp';
  email: string;
  otpCode: string;
  userId: string;
  correlationId?: string;
}

export interface PasswordResetJobData {
  jobName: 'password-reset';
  email: string;
  token: string;
  correlationId?: string;
}

export interface SecurityAlertJobData {
  jobName: 'security-alert';
  email: string;
  userId: string;
  event: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export interface WelcomeEmailJobData {
  jobName: 'welcome-email';
  email: string;
  correlationId?: string;
}

export type EmailJobData =
  | EmailVerificationJobData
  | MagicOtpJobData
  | PasswordResetJobData
  | SecurityAlertJobData
  | WelcomeEmailJobData;
