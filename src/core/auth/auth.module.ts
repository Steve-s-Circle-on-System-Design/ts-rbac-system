import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { SignOptions } from 'jsonwebtoken';

import { QueueModule } from '../../infrastructure/queue/queue.module';
import { UsersModule } from '../users/users.module';

import { AuthController } from './controllers/auth.controller';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PendingUserCleanupJob } from './jobs/pending-user-cleanup.job';
import { AuthListener } from './listeners/auth-events.listener';
import { AuthService } from './services/auth.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordResetService } from './services/password-reset.service';
import { TokenService } from './services/token.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    forwardRef(() => QueueModule),
    TypeOrmModule.forFeature([RefreshToken, EmailVerificationToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>(
          'appConfig.auth.jwtAccessExpiry',
        ) as SignOptions['expiresIn'];

        return {
          secret: configService.getOrThrow<string>(
            'appConfig.auth.jwtAccessSecret',
          ),
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    EmailVerificationService,
    PendingUserCleanupJob,
    PasswordResetService,
    LocalStrategy,
    JwtStrategy,
    AuthListener,
    GoogleStrategy,
  ],
  exports: [
    AuthService,
    TokenService,
    EmailVerificationService,
    PasswordResetService,
    JwtModule,
  ],
})
export class AuthModule {}
