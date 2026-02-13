import { Injectable } from '@nestjs/common';

import {
  MovieDetailsResponseDto,
  MoviesResponseDto,
  TmdbMovieDetailsResponseDto,
  TMDBMoviesResponseDto,
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
}
