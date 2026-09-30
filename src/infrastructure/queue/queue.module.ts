import { EmailQueueErrorHandler } from './email-queue-error-handler.provider';

import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../../core/auth/auth.module';
import { AuthProcessor } from '../../core/auth/processors/auth.processor';
import { EmailConsumer } from '../email/email.consumer';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    EmailModule,
    ConfigModule,
    forwardRef(() => AuthModule),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('redisConfig.host'),
          port: configService.getOrThrow<number>('redisConfig.port'),
        },
      }),
    }),

    BullModule.registerQueue(
      {
        name: 'email-queue',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
      { name: 'auth' },
    ),
  ],
  providers: [EmailConsumer, AuthProcessor, EmailQueueErrorHandler],
  exports: [BullModule],
})
export class QueueModule {}
