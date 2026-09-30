export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export interface CreatePendingLogParams {
  jobId: string;
  jobName: string;
  recipient: string;
  payloadMetadata?: Record<string, unknown>;
}

export interface MarkSentParams {
  providerResponseId?: string;
}

export interface MarkFailedParams {
  errorMessage: string;
  errorMetadata?: Record<string, unknown>;
}
