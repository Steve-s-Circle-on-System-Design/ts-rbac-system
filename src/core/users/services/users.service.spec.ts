import { UsersService } from './users.service';

import { EventEmitter2 } from '@nestjs/event-emitter';

import type { UUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { User } from '../entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    addSelect: jest.Mock;
    where: jest.Mock;
    getOne: jest.Mock;
  };
  let events: { emit: jest.Mock };

  beforeEach(() => {
    queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'user-id' }),
    };
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    events = { emit: jest.fn() };
    service = new UsersService(
      repository as unknown as Repository<User>,
      events as unknown as EventEmitter2,
    );
  });

  it('normalizes email addresses across lookup helpers', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await service.findOneByEmail('  User@Example.COM ');
    await service.findOneByEmailWithPassword('  User@Example.COM ');

    expect(repository.findOneBy).toHaveBeenCalledWith({
      email: 'user@example.com',
    });
    expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.password');
    expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :email', {
      email: 'user@example.com',
    });
  });

  it('creates and saves a user entity', async () => {
    const entity = { id: 'user-id', email: 'user@example.com' } as User;
    repository.create.mockReturnValue(entity);
    repository.save.mockResolvedValue(entity);

    await expect(service.create({ email: entity.email })).resolves.toBe(entity);
    expect(repository.create).toHaveBeenCalledWith({ email: entity.email });
    expect(repository.save).toHaveBeenCalledWith(entity);
  });

  it('delegates basic repository operations', async () => {
    const id = '1aa6c952-c649-4d02-8f5b-d705caea7f75' as UUID;
    repository.findOneBy.mockResolvedValue(null);
    repository.find.mockResolvedValue([]);

    await service.findOneById(id);
    await service.findAll();
    await service.update(id, { name: 'Updated' });
    await service.remove(id);

    expect(repository.findOneBy).toHaveBeenCalledWith({ id });
    expect(repository.find).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith(id, { name: 'Updated' });
    expect(repository.delete).toHaveBeenCalledWith(id);
  });

  it('emits profile uploads and returns an immediate acknowledgement', () => {
    const file = { buffer: Buffer.from('image') } as Express.Multer.File;

    expect(service.uploadProfilePicture('user-id', file)).toEqual({
      message: 'Profile picture upload started',
    });
    expect(events.emit).toHaveBeenCalledWith('user.profile_picture.upload', {
      userId: 'user-id',
      file,
    });
  });

  it('updates the stored profile picture URL', async () => {
    await service.updateProfilePicture('user-id', 'https://image.test/a.jpg');

    expect(repository.update).toHaveBeenCalledWith('user-id', {
      profilePicture: 'https://image.test/a.jpg',
    });
  });

  it('finds a user by googleId', async () => {
    const googleUser = { id: 'user-id', googleId: 'g-12345' } as User;
    repository.findOneBy.mockResolvedValue(googleUser);

    await expect(service.findOneByGoogleId('g-12345')).resolves.toBe(
      googleUser,
    );
    expect(repository.findOneBy).toHaveBeenCalledWith({ googleId: 'g-12345' });
  });

  it('returns null when no user matches the googleId', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOneByGoogleId('missing-id')).resolves.toBeNull();
  });
});
