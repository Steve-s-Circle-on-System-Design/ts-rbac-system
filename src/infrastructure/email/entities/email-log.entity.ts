import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EmailLogStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // BullMQ job ID — indexed for lookup on retry/state updates
  @Column()
  @Index({ unique: true })
  jobId!: string;

  // e.g. 'email-verification' | 'magic-otp' | 'password-reset' | 'security-alert'
  @Column()
  jobName!: string;

  @Column()
  @Index()
  recipient!: string;

  // Non-sensitive payload metadata (subject/template data, correlation id, etc.)
  // Avoid storing raw tokens/OTP codes here — log metadata, not secrets.
  @Column({ type: 'jsonb', nullable: true })
  payloadMetadata?: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: EmailLogStatus,
    default: EmailLogStatus.PENDING,
  })
  @Index()
  status!: EmailLogStatus;

  @Column({ default: 0 })
  attempts!: number;

  // Resend's response id (or equivalent provider message id)
  @Column({ nullable: true })
  providerResponseId?: string;

  @Column({ nullable: true, type: 'text' })
  errorMessage?: string;

  @Column({ nullable: true, type: 'jsonb' })
  errorMetadata?: Record<string, unknown>;

  @CreateDateColumn()
  @Index()
  createdAt!: Date;

  @Column({ nullable: true })
  sentAt?: Date;

  @Column({ nullable: true })
  failedAt?: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
