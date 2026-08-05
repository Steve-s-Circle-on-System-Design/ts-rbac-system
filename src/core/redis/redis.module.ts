import { RedisHealthService } from './redis.health-check';
import { redisProvider } from './redis.provider';

import { Module } from '@nestjs/common';

@Module({
  providers: [redisProvider, RedisHealthService],
  exports: [redisProvider],
})
export class RedisModule {}
