import { EmailLogService } from './email-log.service';
import { EmailService } from './email.service';

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailLog } from './entities/email-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmailLog])],
  providers: [EmailService, EmailLogService],
  exports: [EmailService, EmailLogService],
})
export class EmailModule {}
