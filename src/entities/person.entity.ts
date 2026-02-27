import { Column, Entity, OneToMany } from 'typeorm';

import { BaseEntity } from './base.entity';
import { MediaPerson } from './media-person.entity';

export enum PersonRole {
  ACTOR = 'actor',
  DIRECTOR = 'director',
}

@Entity()
export class Person extends BaseEntity {
  @Column({ unique: true })
  tmdbId: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  profilePath: string | null;

  @OneToMany(() => MediaPerson, (mediaPerson) => mediaPerson.person)
  mediaPersons: MediaPerson[];
}
