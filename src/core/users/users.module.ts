import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersController } from './controllers/users.controller';
import { User } from './entities/user.entity';
import { UserLockoutService } from './services/user-lockout.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, UserLockoutService],
  exports: [TypeOrmModule, UsersService, UserLockoutService],
  controllers: [UsersController],
})
export class UsersModule {}
