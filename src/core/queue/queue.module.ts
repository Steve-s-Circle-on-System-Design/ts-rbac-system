// src/queue/queue.module.ts
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { EmailModule } from '../email/email.module';

import { EmailProcessor } from './processors/email.processor';

@Module({
  imports: [
    EmailModule,
    ConfigModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('redisConfig.host'),
          port: configService.getOrThrow<number>('redisConfig.port'),
        },
      }),
    }),

    BullModule.registerQueue({ name: 'email' }),
  ],
  providers: [EmailProcessor],
  exports: [BullModule],
})
export class QueueModule {}
