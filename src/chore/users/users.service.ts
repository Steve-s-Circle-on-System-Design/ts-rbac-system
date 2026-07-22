import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import type { UUID } from 'node:crypto';
import { DeleteResult, Repository, UpdateResult } from 'typeorm';

import { User } from '../auth/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  create(userInformation: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userInformation);
    return this.usersRepository.save(user);
  }

  findOneById(id: UUID): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  findOneByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
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
}
