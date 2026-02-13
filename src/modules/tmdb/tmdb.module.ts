import { Module } from '@nestjs/common';

import { TmdbController } from './tmdb.controller';
import { TmdbService } from './tmdb.service';
import { TmdbResponseMapperService } from './tmdb-response-mapper.service';

@Module({
  controllers: [TmdbController],
  providers: [TmdbService, TmdbResponseMapperService],
})
export class TmdbModule {}
