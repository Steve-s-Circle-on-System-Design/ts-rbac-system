export class EmailProviderError extends Error {
  readonly metadata?: Record<string, unknown>;

  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message);
    this.name = 'EmailProviderError';
    this.metadata = metadata;
  }
}
