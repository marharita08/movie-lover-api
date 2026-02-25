import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
});

const makePersonDto = (overrides = {}) => ({
  tmdbId: 1,
  name: 'Actor Name',
  profilePath: '/profile.jpg',
  imdbId: 'nm1234567',
  ...overrides,
});

const makePerson = (overrides: Partial<Person> = {}): Person =>
  ({
    id: 'person-uuid',
    tmdbId: 1,
    name: 'Actor Name',
    profilePath: '/profile.jpg',
    imdbId: 'nm1234567',
    ...overrides,
  }) as Person;

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
        imdbId: dto.imdbId,
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
      const dto = makePersonDto({ profilePath: null, imdbId: null });
      const person = makePerson({ profilePath: null, imdbId: null });
      personRepository.findOne.mockResolvedValue(person);

      const result = await service.getOrCreate(dto);

      expect(mockInsertQueryBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({ profilePath: null, imdbId: null }),
      );
      expect(result).toBe(person);
    });
  });
});
