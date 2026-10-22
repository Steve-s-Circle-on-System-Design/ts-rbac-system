import { EmailLogService } from './email-log.service';
import { EMAIL_PROVIDER, IEmailProvider } from './email-provider.interface';
import { EmailService } from './email.service';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailLog } from './entities/email-log.entity';
import { MockEmailProvider } from './providers/mock-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailLog])],
  providers: [
    EmailService,
    EmailLogService,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (configService: ConfigService): IEmailProvider => {
        const isTest = configService.get<string>('NODE_ENV') === 'test';
        const apiKey = configService.get<string>('RESEND_API_KEY');
        if (isTest || !apiKey) {
          return new MockEmailProvider();
        }
        return new ResendEmailProvider(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [EmailService, EMAIL_PROVIDER, EmailLogService],
})
export class EmailModule {}
