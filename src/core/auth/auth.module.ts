import { AuthController } from './auth.controller';
import { AuthListener } from './auth.listener';
import { AuthService } from './auth.service';

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { SignOptions } from 'jsonwebtoken';

import { QueueModule } from '../queue/queue.module';
import { UsersModule } from '../users/users.module';

import { RefreshToken } from './entities/refresh-token.entity';
import { JwtStrategy } from './strategy/jwt.strategy';
import { LocalStrategy } from './strategy/local.strategy';

@Module({
  imports: [
    UsersModule,
    QueueModule,
    TypeOrmModule.forFeature([RefreshToken]),
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
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, AuthListener],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
