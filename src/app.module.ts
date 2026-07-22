// Import all the system modules here
// Import Controller and Service
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './chore/auth/auth.module';
import { UsersModule } from './chore/users/users.module';
import appConfig from './shared/config/app.config';
import { databaseConfig } from './shared/config/database.config';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    // 1. Core system configuration
    ConfigModule.forRoot({
      load: [databaseConfig, appConfig],
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. Rate Limiting -> 10 req/min
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 10,
        },
      ],
    }),

    // 3. Cache module
    CacheModule.register({
      isGlobal: true,
      ttl: 30000,
      max: 100, // Items in the cache
    }),

    // 4. Database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow('database'),
    }),

    // 5. Scheduled tasks
    ScheduleModule.forRoot(),

    // 6. Feature and utility modules (call them here), (Utility - EventsModule and EmailModule)
  ],

  controllers: [],
  providers: [],
})
export class AppModule {}
