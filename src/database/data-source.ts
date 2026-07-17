
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config();

const configService = new ConfigService();

export default new DataSource({
    type: 'postgres',
    url: configService.get('DATABASE_URL'),
    ssl: {
        rejectUnauthorized: false,
    },
    entities: ['src/**/*.entity.ts'],
    migrations: ['src/database/migrations/*.ts'],
    migrationsTableName: 'migrations',
});