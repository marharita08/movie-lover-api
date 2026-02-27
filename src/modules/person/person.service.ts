import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Person } from 'src/entities';

import { GetOrCreatePersonDto } from './dto/get-or-create-person.dto';

@Injectable()
export class PersonService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
  ) {}

  async getOrCreate(dto: GetOrCreatePersonDto) {
    await this.personRepository
      .createQueryBuilder()
      .insert()
      .into(Person)
      .values({
        tmdbId: dto.tmdbId,
        name: dto.name,
        profilePath: dto.profilePath,
      })
      .orIgnore()
      .execute();

    return await this.personRepository.findOne({
      where: { tmdbId: dto.tmdbId },
    });
  }
}
