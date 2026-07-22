import { User } from './user.entity';

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index()
  token!: string;

  @Column()
  tokenFamily!: string; // Same family for rotated tokens

  @Column({ nullable: true })
  rotatedFrom?: string; // Previous token ID

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: string;

  @Column()
  expiresAt!: Date;

  @Column({ nullable: true })
  revokedAt?: Date;

  @Column({ nullable: true })
  revokedReason?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ nullable: true })
  ipAddress?: string;

  @CreateDateColumn()
  createdAt!: Date;

  // Check if token is expired
  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  // Check if token is revoked
  isRevoked(): boolean {
    return !!this.revokedAt;
  }

  // Check if token is valid (not expired and not revoked)
  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }
}
