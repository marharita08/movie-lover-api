import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Person } from 'src/entities';

import { GetOrCreatePersonDto } from './dto/get-or-create-person.dto';

@Injectable()
export class PersonService {
  private readonly logger = new Logger(PersonService.name);

  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupOrphanedPeople() {
    this.logger.log('Starting cleanup of orphaned people');

    try {
      const orphanedPeople = await this.personRepository
        .createQueryBuilder('person')
        .leftJoin('person.mediaPeople', 'mediaPerson')
        .where('mediaPerson.id IS NULL')
        .getMany();

      this.logger.log(
        `Found ${orphanedPeople.length} orphaned people to delete`,
      );

      if (orphanedPeople.length > 0) {
        const orphanedIds = orphanedPeople.map((item) => item.id);

        await this.personRepository.delete(orphanedIds);

        this.logger.log(
          `Successfully deleted ${orphanedPeople.length} orphaned people`,
        );
      }

      this.logger.log('Completed cleanup of orphaned people');
    } catch (error) {
      this.logger.error('Error in cleanupOrphanedPeople cron job:', error);
    }
  }

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
