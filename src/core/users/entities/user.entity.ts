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

import { PasswordReset } from '../../auth/entities/password-reset.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { AccountStatus, AuthProvider, UserRole } from '../enums/user.enum';

@Entity('users')
// @Index(['email']) // Indexed email
export class User {
  @PrimaryGeneratedColumn('uuid') // UUID for better security
  id!: string;

  @Column({ unique: true })
  @Index()
  email!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', select: false, nullable: true }) // Hidden from queries AND allows null for social login
  password?: string | null; // Appended "?" to make it optional incase the signup came from social

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

  @Column({ type: 'varchar', nullable: true, unique: true })
  googleId?: string | null; // For Google OAuth

  @Column({
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  authProvider!: AuthProvider;

  @Column({ default: false })
  isVerified: boolean = false;

  @Column({ type: 'varchar', nullable: true })
  verificationToken!: string | null;

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
  emailToLowerCase(): void {
    if (this.email) {
      this.email = this.email.toLowerCase();
    }
  }

  // Check if account is locked
  isLocked(): boolean {
    return !!(this.lockedUntil && this.lockedUntil > new Date());
  }

  // Check if email is verified
  isEmailVerified(): boolean {
    return !!this.emailVerifiedAt;
  }
}
