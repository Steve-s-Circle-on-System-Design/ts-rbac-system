import { PasswordReset } from './password-reset.entity';
import { RefreshToken } from './refresh-token.entity';

import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

@Entity('users')
@Index(['email']) // Indexed email
export class User {
  @PrimaryGeneratedColumn('uuid') // UUID for better security
  id!: string;

  @Column({ unique: true })
  @Index()
  email!: string;

  @Column()
  name!: string;

  @Column({ select: false, nullable: true }) // Hidden from queries AND allows null for social login
  password?: string; // Appended "?" to make it optional incase the signup came from social

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.PENDING_VERIFICATION,
  })
  status!: AccountStatus;

  @Column({ nullable: true })
  emailVerifiedAt?: Date;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ nullable: true })
  lastLoginIp?: string;

  @Column({ default: 0 })
  loginAttempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  // Added | null here // Account lock until date (after too many failed attempts)
  lockedUntil?: Date | null;

  @Column({ nullable: true })
  profilePicture?: string;

  @OneToMany(() => RefreshToken, (token) => token.user, { cascade: true })
  refreshTokens!: RefreshToken[];

  @OneToMany(() => PasswordReset, (reset) => reset.user, { cascade: true })
  passwordResets!: PasswordReset[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Columns for social logins
  @Column({ nullable: true })
  provider?: string; // 'google', 'apple', 'local'

  @Column({ nullable: true })
  providerId?: string; // The unique ID returned by Google/Apple

  // Lifecycle hooks
  @BeforeInsert()
  @BeforeUpdate()
  emailToLowerCase() {
    if (this.email) {
      this.email = this.email.toLowerCase();
    }
  }

  // Check if account is locked
  isLocked(): boolean | null {
    return !!(this.lockedUntil && this.lockedUntil > new Date());
  }

  // Check if email is verified
  isEmailVerified(): boolean {
    return !!this.emailVerifiedAt;
  }
}
