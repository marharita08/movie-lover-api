import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MediaPerson, PersonRole } from 'src/entities';
import { PersonService } from 'src/modules/person/person.service';
import { TmdbService } from 'src/modules/tmdb/tmdb.service';

import { CastMemberDto } from '../tmdb/dto';

import { MediaPersonService } from './media-person.service';

const mockMediaPersonRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockTmdbService = () => ({
  getPerson: jest.fn(),
});

const mockPersonService = () => ({
  getOrCreate: jest.fn(),
});

const makePersonData = (
  overrides: Partial<CastMemberDto> = {},
): CastMemberDto => ({
  id: 1,
  name: 'Actor Name',
  profilePath: '/profile.jpg',
  character: 'Hero',
  order: 0,
  ...overrides,
});

const makePerson = (overrides = {}) => ({
  id: 'person-uuid',
  tmdbId: 1,
  name: 'Actor Name',
  imdbId: 'nm1234567',
  ...overrides,
});

const makeMediaPerson = (overrides: Partial<MediaPerson> = {}): MediaPerson =>
  ({
    id: 'media-person-uuid',
    mediaItemId: 'media-uuid',
    personId: 'person-uuid',
    role: PersonRole.ACTOR,
    ...overrides,
  }) as MediaPerson;

describe('MediaPersonService', () => {
  let service: MediaPersonService;
  let mediaPersonRepository: jest.Mocked<Repository<MediaPerson>>;
  let tmdbService: jest.Mocked<TmdbService>;
  let personService: jest.Mocked<PersonService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaPersonService,
        {
          provide: getRepositoryToken(MediaPerson),
          useFactory: mockMediaPersonRepository,
        },
        { provide: TmdbService, useFactory: mockTmdbService },
        { provide: PersonService, useFactory: mockPersonService },
      ],
    }).compile();

    service = module.get(MediaPersonService);
    mediaPersonRepository = module.get(getRepositoryToken(MediaPerson));
    tmdbService = module.get(TmdbService);
    personService = module.get(PersonService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('add', () => {
    it('should fetch person info, create and save media person relation', async () => {
      const personData = makePersonData();
      const person = makePerson();
      const mediaPerson = makeMediaPerson();

      tmdbService.getPerson.mockResolvedValue({ imdbId: 'nm1234567' } as never);
      personService.getOrCreate.mockResolvedValue(person as never);
      mediaPersonRepository.findOne.mockResolvedValue(null as never);
      mediaPersonRepository.create.mockReturnValue(mediaPerson);
      mediaPersonRepository.save.mockResolvedValue(mediaPerson);

      await service.add('media-uuid', personData, PersonRole.ACTOR);

      expect(tmdbService.getPerson).toHaveBeenCalledWith(personData.id);
      expect(personService.getOrCreate).toHaveBeenCalledWith({
        tmdbId: personData.id,
        name: personData.name,
        profilePath: personData.profilePath,
        imdbId: 'nm1234567',
      });
      expect(mediaPersonRepository.findOne).toHaveBeenCalledWith({
        where: {
          mediaItemId: 'media-uuid',
          personId: person.id,
          role: PersonRole.ACTOR,
        },
      });
      expect(mediaPersonRepository.create).toHaveBeenCalledWith({
        mediaItemId: 'media-uuid',
        personId: person.id,
        role: PersonRole.ACTOR,
      });
      expect(mediaPersonRepository.save).toHaveBeenCalledWith(mediaPerson);
    });

    it('should use null as imdbId if tmdbService.getPerson returns null', async () => {
      const personData = makePersonData();
      const person = makePerson();
      tmdbService.getPerson.mockResolvedValue(null);
      personService.getOrCreate.mockResolvedValue(person as never);
      mediaPersonRepository.findOne.mockResolvedValue(null as never);
      mediaPersonRepository.create.mockReturnValue(makeMediaPerson());
      mediaPersonRepository.save.mockResolvedValue(makeMediaPerson());

      await service.add('media-uuid', personData, PersonRole.ACTOR);

      expect(personService.getOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({ imdbId: null }),
      );
    });

    it('should not save relation if it already exists', async () => {
      const personData = makePersonData();
      const person = makePerson();
      const existingRelation = makeMediaPerson();

      tmdbService.getPerson.mockResolvedValue(null);
      personService.getOrCreate.mockResolvedValue(person as never);
      mediaPersonRepository.findOne.mockResolvedValue(existingRelation);

      await service.add('media-uuid', personData, PersonRole.ACTOR);

      expect(mediaPersonRepository.create).not.toHaveBeenCalled();
      expect(mediaPersonRepository.save).not.toHaveBeenCalled();
    });

    it('should not throw if person is not found after getOrCreate', async () => {
      const personData = makePersonData();
      tmdbService.getPerson.mockResolvedValue(null);
      personService.getOrCreate.mockResolvedValue(null);

      await expect(
        service.add('media-uuid', personData, PersonRole.ACTOR),
      ).resolves.not.toThrow();

      expect(mediaPersonRepository.findOne).not.toHaveBeenCalled();
      expect(mediaPersonRepository.save).not.toHaveBeenCalled();
    });

    it('should not throw if an unexpected error occurs', async () => {
      tmdbService.getPerson.mockRejectedValue(new Error('Network error'));

      await expect(
        service.add('media-uuid', makePersonData(), PersonRole.ACTOR),
      ).resolves.not.toThrow();
    });
  });

  describe('saveAll', () => {
    it('should call add for each person in the list', async () => {
      const persons = [makePersonData({ id: 1 }), makePersonData({ id: 2 })];
      const addSpy = jest.spyOn(service, 'add').mockResolvedValue(undefined);

      await service.saveAll('media-uuid', persons, PersonRole.ACTOR);

      expect(addSpy).toHaveBeenCalledTimes(2);
      expect(addSpy).toHaveBeenCalledWith(
        'media-uuid',
        persons[0],
        PersonRole.ACTOR,
      );
      expect(addSpy).toHaveBeenCalledWith(
        'media-uuid',
        persons[1],
        PersonRole.ACTOR,
      );
    });

    it('should resolve even if some add calls fail', async () => {
      const persons = [makePersonData({ id: 1 }), makePersonData({ id: 2 })];
      jest
        .spyOn(service, 'add')
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await expect(
        service.saveAll('media-uuid', persons, PersonRole.ACTOR),
      ).resolves.not.toThrow();
    });

    it('should do nothing for empty list', async () => {
      const addSpy = jest.spyOn(service, 'add');

      await service.saveAll('media-uuid', [], PersonRole.ACTOR);

      expect(addSpy).not.toHaveBeenCalled();
    });
  });
});
