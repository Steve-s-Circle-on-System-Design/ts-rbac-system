import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('password_resets')
export class PasswordReset {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ unique: true })
    @Index()
    token!: string;

    @ManyToOne(() => User, (user) => user.passwordResets, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @Column()
    userId!: string;

    @Column()
    expiresAt!: Date;

    @Column({ default: false })
    isUsed!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    // Check if token is expired
    isExpired(): boolean {
        return this.expiresAt < new Date();
    }

    // Check if token can be used
    canBeUsed(): boolean {
        return !this.isUsed && !this.isExpired();
    }
}