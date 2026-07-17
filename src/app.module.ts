
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { databaseConfig } from './shared/config/database.config';
import appConfig from './shared/config/app.config';

// Import all the system modules here

// Import Controller and Service
import { AppController } from './app.controller';
import { AppService } from './app.service';


@Module({
  imports: [
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
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
      }),
    }),

    // 5. Scheduled tasks
    ScheduleModule.forRoot(),

    // 6. Feature and utility modules (call them here), (Utility - EventsModule and EmailModule)
    
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }