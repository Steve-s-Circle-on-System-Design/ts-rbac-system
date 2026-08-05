import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Redis => {
    return new Redis({
      host: configService.getOrThrow<string>('redisConfig.host'),
      port: configService.getOrThrow<number>('redisConfig.port'),
    });
  },
};
