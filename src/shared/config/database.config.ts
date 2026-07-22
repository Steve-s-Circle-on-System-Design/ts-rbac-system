import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : false,
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV !== 'production',
    // Autoload database entities
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    // Production migration of entity changes
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsRun: process.env.NODE_ENV === 'production', // Auto-run migrations in production
    migrationsTableName: 'migrations',

    extra: {
      max: 20,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    },
    retryAttempts: 5,
    retryDelay: 3000,
  }),
);
