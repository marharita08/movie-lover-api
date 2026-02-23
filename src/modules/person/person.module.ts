import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Person } from 'src/entities';

import { PersonService } from './person.service';

@Module({
  imports: [TypeOrmModule.forFeature([Person])],
  providers: [PersonService],
  exports: [PersonService],
})
export class PersonModule {}
