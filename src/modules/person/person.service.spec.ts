import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeleteResult, Repository, SelectQueryBuilder } from 'typeorm';

import { Person } from 'src/entities';

import { PersonService } from './person.service';

const mockInsertQueryBuilder = {
  insert: jest.fn().mockReturnThis(),
  into: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orIgnore: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue(undefined),
};

const mockPersonRepository = () => ({
  createQueryBuilder: jest.fn().mockReturnValue(mockInsertQueryBuilder),
  findOne: jest.fn(),
  delete: jest.fn(),
});

const makePersonDto = (overrides = {}) => ({
  tmdbId: 1,
  name: 'Actor Name',
  profilePath: '/profile.jpg',
  ...overrides,
});

const makePerson = (overrides: Partial<Person> = {}): Person =>
  ({
    id: 'person-uuid',
    tmdbId: 1,
    name: 'Actor Name',
    profilePath: '/profile.jpg',
    ...overrides,
  }) as Person;

type MockQueryBuilder = {
  leftJoin: jest.Mock;
  where: jest.Mock;
  getMany: jest.Mock;
};

const mockQueryBuilder = (): MockQueryBuilder => {
  const qb: MockQueryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  return qb;
};

describe('PersonService', () => {
  let service: PersonService;
  let personRepository: jest.Mocked<Repository<Person>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonService,
        {
          provide: getRepositoryToken(Person),
          useFactory: mockPersonRepository,
        },
      ],
    }).compile();

    service = module.get(PersonService);
    personRepository = module.get(getRepositoryToken(Person));
  });

  afterEach(() => jest.clearAllMocks());

  describe('getOrCreate', () => {
    it('should insert person with orIgnore and return found person', async () => {
      const dto = makePersonDto();
      const person = makePerson();
      personRepository.findOne.mockResolvedValue(person);

      const result = await service.getOrCreate(dto);

      expect(personRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockInsertQueryBuilder.insert).toHaveBeenCalled();
      expect(mockInsertQueryBuilder.into).toHaveBeenCalledWith(Person);
      expect(mockInsertQueryBuilder.values).toHaveBeenCalledWith({
        tmdbId: dto.tmdbId,
        name: dto.name,
        profilePath: dto.profilePath,
      });
      expect(mockInsertQueryBuilder.orIgnore).toHaveBeenCalled();
      expect(mockInsertQueryBuilder.execute).toHaveBeenCalled();
      expect(personRepository.findOne).toHaveBeenCalledWith({
        where: { tmdbId: dto.tmdbId },
      });
      expect(result).toBe(person);
    });

    it('should return null if person is not found after insert', async () => {
      const dto = makePersonDto();
      personRepository.findOne.mockResolvedValue(null);

      const result = await service.getOrCreate(dto);

      expect(result).toBeNull();
    });

    it('should work correctly with nullable profilePath and imdbId', async () => {
      const dto = makePersonDto({ profilePath: null });
      const person = makePerson({ profilePath: null });
      personRepository.findOne.mockResolvedValue(person);

      const result = await service.getOrCreate(dto);

      expect(mockInsertQueryBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({ profilePath: null }),
      );
      expect(result).toBe(person);
    });
  });

  describe('cleanupOrphanedMediaItems', () => {
    it('should find and delete orphaned media items', async () => {
      const orphan1 = makePerson({
        id: 'orphan-1',
        name: 'Orphaned Person 1',
      });
      const orphan2 = makePerson({
        id: 'orphan-2',
        name: 'Orphaned Person 2',
      });

      const qb = mockQueryBuilder();
      qb.getMany.mockResolvedValue([orphan1, orphan2]);
      personRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<Person>,
      );
      const deleteResult: DeleteResult = { affected: 2, raw: [] };
      personRepository.delete.mockResolvedValue(deleteResult);

      await service.cleanupOrphanedPeople();

      expect(personRepository.createQueryBuilder).toHaveBeenCalledWith(
        'person',
      );
      expect(qb.leftJoin).toHaveBeenCalledWith(
        'person.mediaPeople',
        'mediaPerson',
      );
      expect(qb.where).toHaveBeenCalledWith('mediaPerson.id IS NULL');
      expect(qb.getMany).toHaveBeenCalled();
      expect(personRepository.delete).toHaveBeenCalledWith([
        'orphan-1',
        'orphan-2',
      ]);
    });

    it('should not delete anything when no orphaned items found', async () => {
      const qb = mockQueryBuilder();
      qb.getMany.mockResolvedValue([]);
      personRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<Person>,
      );

      await service.cleanupOrphanedPeople();

      expect(qb.getMany).toHaveBeenCalled();
      expect(personRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const qb = mockQueryBuilder();
      qb.getMany.mockRejectedValue(new Error('Database error'));
      personRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<Person>,
      );

      await expect(service.cleanupOrphanedPeople()).resolves.not.toThrow();

      expect(personRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const orphan = makePerson({
        id: 'orphan-1',
        name: 'Orphaned Person',
      });

      const qb = mockQueryBuilder();
      qb.getMany.mockResolvedValue([orphan]);
      personRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<Person>,
      );
      personRepository.delete.mockRejectedValue(new Error('Deletion failed'));

      await expect(service.cleanupOrphanedPeople()).resolves.not.toThrow();
    });

    it('should log the number of orphaned items found', async () => {
      const orphan1 = makePerson({ id: 'orphan-1' });
      const orphan2 = makePerson({ id: 'orphan-2' });
      const orphan3 = makePerson({ id: 'orphan-3' });

      const qb = mockQueryBuilder();
      qb.getMany.mockResolvedValue([orphan1, orphan2, orphan3]);
      personRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as SelectQueryBuilder<Person>,
      );
      const deleteResult: DeleteResult = { affected: 3, raw: [] };
      personRepository.delete.mockResolvedValue(deleteResult);

      await service.cleanupOrphanedPeople();

      expect(personRepository.delete).toHaveBeenCalledWith([
        'orphan-1',
        'orphan-2',
        'orphan-3',
      ]);
    });
  });
});
