import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import type { UUID } from 'node:crypto';
import { DeleteResult, Repository, UpdateResult } from 'typeorm';

import { User } from '../entities/user.entity';
import { AccountStatus } from '../enums/user.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  create(userInformation: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userInformation);
    return this.usersRepository.save(user);
  }

  findOneById(id: UUID): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({
      email: this.normalizeEmail(email),
    });
  }

  findOneByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: this.normalizeEmail(email) })
      .getOne();
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  update(id: UUID, userInformation: Partial<User>): Promise<UpdateResult> {
    return this.usersRepository.update(id, userInformation);
  }

  remove(id: UUID): Promise<DeleteResult> {
    return this.usersRepository.delete(id);
  }

  uploadProfilePicture(
    userId: string,
    file: Express.Multer.File,
  ): { message: string } {
    this.eventEmitter.emit('user.profile_picture.upload', {
      userId,
      file,
    });

    return {
      message: 'Profile picture upload started',
    };
  }

  async updateProfilePicture(
    userId: string,
    profilePicture: string,
  ): Promise<UpdateResult> {
    return this.usersRepository.update(userId, {
      profilePicture,
    });
  }

  findOneByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ googleId });
  }

  async removeStalePendingRegistrations(cutoff: Date): Promise<DeleteResult> {
    return this.usersRepository
      .createQueryBuilder()
      .delete()
      .from(User)
      .where('status = :status', { status: AccountStatus.PENDING_VERIFICATION })
      .andWhere('createdAt < :cutoff', { cutoff })
      .execute();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
