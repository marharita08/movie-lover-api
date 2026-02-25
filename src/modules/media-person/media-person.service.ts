import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MediaPerson, PersonRole } from 'src/entities';
import { PersonService } from 'src/modules/person/person.service';
import { TmdbService } from 'src/modules/tmdb/tmdb.service';

import { CastMemberDto, CrewMemberDto } from '../tmdb/dto';

@Injectable()
export class MediaPersonService {
  private readonly logger = new Logger(MediaPersonService.name);

  constructor(
    @InjectRepository(MediaPerson)
    private readonly mediaPersonRepository: Repository<MediaPerson>,
    private readonly tmdbService: TmdbService,
    private readonly personService: PersonService,
  ) {}

  async add(
    mediaItemId: string,
    personData: CrewMemberDto | CastMemberDto,
    role: PersonRole,
  ) {
    try {
      const personInfo = await this.tmdbService.getPerson(personData.id);

      const person = await this.personService.getOrCreate({
        tmdbId: personData.id,
        name: personData.name,
        profilePath: personData.profilePath,
        imdbId: personInfo?.imdbId || null,
      });

      if (!person) {
        throw new Error(`Person ${personData.id} not found`);
      }

      const existingRelation = await this.mediaPersonRepository.findOne({
        where: {
          mediaItemId,
          personId: person.id,
          role,
        },
      });

      if (!existingRelation) {
        const mediaPerson = this.mediaPersonRepository.create({
          mediaItemId,
          personId: person.id,
          role,
        });

        await this.mediaPersonRepository.save(mediaPerson);
      }
    } catch (error) {
      this.logger.error(`Error saving person ${personData.id}:`, error);
    }
  }

  async saveAll(
    mediaItemId: string,
    persons: CrewMemberDto[] | CastMemberDto[],
    role: PersonRole,
  ) {
    await Promise.all(
      persons.map((person: CrewMemberDto | CastMemberDto) =>
        this.add(mediaItemId, person, role),
      ),
    );
  }
}
