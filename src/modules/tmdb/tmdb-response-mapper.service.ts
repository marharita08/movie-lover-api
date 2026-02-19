import { Injectable } from '@nestjs/common';

import {
  CreditsResponseDto,
  MovieDetailsResponseDto,
  MoviesResponseDto,
  PersonResponseDto,
  TmdbAggregateCreditsResponseDto,
  TmdbCreditsResponseDto,
  TmdbMovieDetailsResponseDto,
  TMDBMoviesResponseDto,
  TmdbPersonResponseDto,
  TmdbTvShowDetailsResponseDto,
  TvShowDetailsResponseDto,
} from './dto';

@Injectable()
export class TmdbResponseMapperService {
  mapMovieDetails(
    tmdbMovieDetails: TmdbMovieDetailsResponseDto,
  ): MovieDetailsResponseDto {
    return {
      adult: tmdbMovieDetails.adult,
      backdropPath: tmdbMovieDetails.backdrop_path,
      belongsToCollection: tmdbMovieDetails.belongs_to_collection
        ? {
            id: tmdbMovieDetails.belongs_to_collection.id,
            name: tmdbMovieDetails.belongs_to_collection.name,
            posterPath: tmdbMovieDetails.belongs_to_collection.poster_path,
            backdropPath: tmdbMovieDetails.belongs_to_collection.backdrop_path,
          }
        : null,
      budget: tmdbMovieDetails.budget,
      genres: tmdbMovieDetails.genres,
      homepage: tmdbMovieDetails.homepage,
      id: tmdbMovieDetails.id,
      imdbId: tmdbMovieDetails.imdb_id,
      originalLanguage: tmdbMovieDetails.original_language,
      originalTitle: tmdbMovieDetails.original_title,
      overview: tmdbMovieDetails.overview,
      popularity: tmdbMovieDetails.popularity,
      posterPath: tmdbMovieDetails.poster_path,
      productionCompanies: (tmdbMovieDetails.production_companies || []).map(
        (company) => ({
          id: company.id,
          logoPath: company.logo_path,
          name: company.name,
          originCountry: company.origin_country,
        }),
      ),
      productionCountries: (tmdbMovieDetails.production_countries || []).map(
        (country) => ({
          iso31661: country.iso_3166_1,
          name: country.name,
        }),
      ),
      releaseDate: tmdbMovieDetails.release_date,
      revenue: tmdbMovieDetails.revenue,
      runtime: tmdbMovieDetails.runtime,
      spokenLanguages: (tmdbMovieDetails.spoken_languages || []).map(
        (language) => ({
          iso6391: language.iso_639_1,
          name: language.name,
          englishName: language.english_name,
        }),
      ),
      status: tmdbMovieDetails.status,
      tagline: tmdbMovieDetails.tagline,
      title: tmdbMovieDetails.title,
      video: tmdbMovieDetails.video,
      voteAverage: tmdbMovieDetails.vote_average,
      voteCount: tmdbMovieDetails.vote_count,
    };
  }

  mapMoviesResponse(data: TMDBMoviesResponseDto): MoviesResponseDto {
    return {
      page: data.page,
      results: data.results.map((movie) => ({
        adult: movie.adult,
        backdropPath: movie.backdrop_path,
        genreIds: movie.genre_ids,
        id: movie.id,
        originalLanguage: movie.original_language,
        originalTitle: movie.original_title,
        overview: movie.overview,
        popularity: movie.popularity,
        posterPath: movie.poster_path,
        releaseDate: movie.release_date,
        title: movie.title,
        video: movie.video,
        voteAverage: movie.vote_average,
        voteCount: movie.vote_count,
      })),
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };
  }

  mapTvShowDetails(
    tmdbTvShowDetails: TmdbTvShowDetailsResponseDto,
  ): TvShowDetailsResponseDto {
    return {
      adult: tmdbTvShowDetails.adult,
      backdropPath: tmdbTvShowDetails.backdrop_path,
      createdBy: (tmdbTvShowDetails.created_by || []).map((person) => ({
        id: person.id,
        name: person.name,
        profilePath: person.profile_path,
      })),
      episodeRunTime: tmdbTvShowDetails.episode_run_time,
      firstAirDate: tmdbTvShowDetails.first_air_date,
      genres: tmdbTvShowDetails.genres,
      homepage: tmdbTvShowDetails.homepage,
      id: tmdbTvShowDetails.id,
      inProduction: tmdbTvShowDetails.in_production,
      languages: tmdbTvShowDetails.languages,
      lastAirDate: tmdbTvShowDetails.last_air_date,
      name: tmdbTvShowDetails.name,
      numberOfEpisodes: tmdbTvShowDetails.number_of_episodes,
      numberOfSeasons: tmdbTvShowDetails.number_of_seasons,
      originCountry: tmdbTvShowDetails.origin_country,
      originalLanguage: tmdbTvShowDetails.original_language,
      originalName: tmdbTvShowDetails.original_name,
      overview: tmdbTvShowDetails.overview,
      popularity: tmdbTvShowDetails.popularity,
      posterPath: tmdbTvShowDetails.poster_path,
      productionCompanies: (tmdbTvShowDetails.production_companies || []).map(
        (company) => ({
          id: company.id,
          logoPath: company.logo_path,
          name: company.name,
          originCountry: company.origin_country,
        }),
      ),
      productionCountries: (tmdbTvShowDetails.production_countries || []).map(
        (country) => ({
          iso31661: country.iso_3166_1,
          name: country.name,
        }),
      ),
      seasons: (tmdbTvShowDetails.seasons || []).map((season) => ({
        airDate: season.air_date,
        episodeCount: season.episode_count,
        id: season.id,
        name: season.name,
        overview: season.overview,
        posterPath: season.poster_path,
        seasonNumber: season.season_number,
        voteAverage: season.vote_average,
      })),
      spokenLanguages: (tmdbTvShowDetails.spoken_languages || []).map(
        (language) => ({
          englishName: language.english_name,
          iso6391: language.iso_639_1,
          name: language.name,
        }),
      ),
      status: tmdbTvShowDetails.status,
      tagline: tmdbTvShowDetails.tagline,
      type: tmdbTvShowDetails.type,
      voteAverage: tmdbTvShowDetails.vote_average,
      voteCount: tmdbTvShowDetails.vote_count,
    };
  }

  mapCredits(
    data: TmdbCreditsResponseDto | TmdbAggregateCreditsResponseDto,
  ): CreditsResponseDto {
    return {
      id: data.id,
      cast: (data.cast || []).map((castMember) => {
        let character = '';
        if ('character' in castMember) {
          character = castMember.character;
        } else if ('roles' in castMember && castMember.roles.length > 0) {
          character = castMember.roles[0].character;
        }

        return {
          id: castMember.id,
          name: castMember.name,
          character,
          profilePath: castMember.profile_path,
          order: castMember.order,
        };
      }),
      crew: (data.crew || []).map((crewMember) => {
        let job = '';
        if ('job' in crewMember) {
          job = crewMember.job;
        } else if ('jobs' in crewMember && crewMember.jobs.length > 0) {
          job = crewMember.jobs[0].job;
        }

        return {
          id: crewMember.id,
          name: crewMember.name,
          job,
          department: crewMember.department,
          profilePath: crewMember.profile_path,
        };
      }),
    };
  }

  mapPerson(data: TmdbPersonResponseDto): PersonResponseDto {
    return {
      adult: data.adult,
      alsoKnownAs: data.also_known_as,
      biography: data.biography,
      birthday: data.birthday,
      deathday: data.deathday,
      gender: data.gender,
      homepage: data.homepage,
      id: data.id,
      imdbId: data.imdb_id,
      knownForDepartment: data.known_for_department,
      name: data.name,
      placeOfBirth: data.place_of_birth,
      popularity: data.popularity,
      profilePath: data.profile_path,
    };
  }
}
