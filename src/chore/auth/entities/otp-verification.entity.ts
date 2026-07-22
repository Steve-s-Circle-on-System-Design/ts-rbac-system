import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('otp_verifications')
@Index(['email', 'code']) // Indexed email and code fields for faster lookups
export class OtpVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  code!: string; // Hashed string for security

  @Column()
  email!: string;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ default: false })
  isUsed!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' }) // To track when it gets marked as "isUsed"
  updatedAt!: Date;

  // Check code expiry
  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  canBeUsed(): boolean {
    return !this.isUsed && !this.isExpired();
  }
}
