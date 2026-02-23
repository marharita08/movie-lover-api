import {
  TmdbAggregateCreditsResponseDto,
  TmdbCreditsResponseDto,
  TmdbMovieDetailsResponseDto,
  TMDBMoviesResponseDto,
  TmdbPersonResponseDto,
  TmdbTvShowDetailsResponseDto,
} from './dto';
import { TmdbResponseMapperService } from './tmdb-response-mapper.service';

describe('TmdbResponseMapperService', () => {
  let service: TmdbResponseMapperService;

  beforeEach(() => {
    service = new TmdbResponseMapperService();
  });

  describe('mapMovieDetails', () => {
    it('should map snake_case fields to camelCase', () => {
      const input = {
        id: 1,
        backdrop_path: '/backdrop.jpg',
        poster_path: '/poster.jpg',
        imdb_id: 'tt1234567',
        original_language: 'en',
        original_title: 'Original Title',
        release_date: '2024-01-01',
        vote_average: 8.5,
        vote_count: 1000,
        production_companies: [],
        production_countries: [],
        spoken_languages: [],
        belongs_to_collection: null,
      } as unknown as TmdbMovieDetailsResponseDto;

      const result = service.mapMovieDetails(input);

      expect(result.backdropPath).toBe('/backdrop.jpg');
      expect(result.posterPath).toBe('/poster.jpg');
      expect(result.imdbId).toBe('tt1234567');
      expect(result.originalLanguage).toBe('en');
      expect(result.originalTitle).toBe('Original Title');
      expect(result.releaseDate).toBe('2024-01-01');
      expect(result.voteAverage).toBe(8.5);
      expect(result.voteCount).toBe(1000);
    });

    it('should map belongs_to_collection if present', () => {
      const input = {
        belongs_to_collection: {
          id: 10,
          name: 'Collection',
          poster_path: '/poster.jpg',
          backdrop_path: '/backdrop.jpg',
        },
        production_companies: [],
        production_countries: [],
        spoken_languages: [],
      } as unknown as TmdbMovieDetailsResponseDto;

      const result = service.mapMovieDetails(input);

      expect(result.belongsToCollection).toEqual({
        id: 10,
        name: 'Collection',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
      });
    });

    it('should return null for belongs_to_collection if not present', () => {
      const input = {
        belongs_to_collection: null,
        production_companies: [],
        production_countries: [],
        spoken_languages: [],
      } as unknown as TmdbMovieDetailsResponseDto;

      const result = service.mapMovieDetails(input);

      expect(result.belongsToCollection).toBeNull();
    });

    it('should handle missing production arrays gracefully', () => {
      const input = {
        belongs_to_collection: null,
      } as unknown as TmdbMovieDetailsResponseDto;

      const result = service.mapMovieDetails(input);

      expect(result.productionCompanies).toEqual([]);
      expect(result.productionCountries).toEqual([]);
      expect(result.spokenLanguages).toEqual([]);
    });
  });

  describe('mapMoviesResponse', () => {
    it('should map page, totalPages, totalResults and results', () => {
      const input = {
        page: 1,
        total_pages: 10,
        total_results: 200,
        results: [
          {
            id: 1,
            backdrop_path: '/backdrop.jpg',
            genre_ids: [1, 2],
            original_language: 'en',
            original_title: 'Original',
            poster_path: '/poster.jpg',
            release_date: '2024-01-01',
            vote_average: 7.5,
            vote_count: 500,
          },
        ],
      } as unknown as TMDBMoviesResponseDto;

      const result = service.mapMoviesResponse(input);

      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(10);
      expect(result.totalResults).toBe(200);
      expect(result.results[0].backdropPath).toBe('/backdrop.jpg');
      expect(result.results[0].genreIds).toEqual([1, 2]);
      expect(result.results[0].originalLanguage).toBe('en');
    });
  });

  describe('mapCredits', () => {
    it('should map character from "character" field for regular credits', () => {
      const input = {
        id: 1,
        cast: [
          {
            id: 1,
            name: 'Actor',
            character: 'Hero',
            profile_path: '/profile.jpg',
            order: 0,
          },
        ],
        crew: [],
      } as unknown as TmdbCreditsResponseDto;

      const result = service.mapCredits(input);

      expect(result.cast[0].character).toBe('Hero');
    });

    it('should map character from roles[0] for aggregate credits', () => {
      const input = {
        id: 1,
        cast: [
          {
            id: 1,
            name: 'Actor',
            roles: [{ character: 'Hero' }, { character: 'Villain' }],
            profile_path: '/profile.jpg',
            order: 0,
          },
        ],
        crew: [],
      } as unknown as TmdbAggregateCreditsResponseDto;

      const result = service.mapCredits(input);

      expect(result.cast[0].character).toBe('Hero');
    });

    it('should return empty character if cast member has no character or roles', () => {
      const input = {
        id: 1,
        cast: [{ id: 1, name: 'Actor', profile_path: null, order: 0 }],
        crew: [],
      } as unknown as TmdbCreditsResponseDto;

      const result = service.mapCredits(input);

      expect(result.cast[0].character).toBe('');
    });

    it('should map job from "job" field for regular credits', () => {
      const input = {
        id: 1,
        cast: [],
        crew: [
          {
            id: 2,
            name: 'Director',
            job: 'Director',
            department: 'Directing',
            profile_path: null,
          },
        ],
      } as unknown as TmdbCreditsResponseDto;

      const result = service.mapCredits(input);

      expect(result.crew[0].job).toBe('Director');
    });

    it('should map job from jobs[0] for aggregate credits', () => {
      const input = {
        id: 1,
        cast: [],
        crew: [
          {
            id: 2,
            name: 'Director',
            jobs: [{ job: 'Director' }, { job: 'Producer' }],
            department: 'Directing',
            profile_path: null,
          },
        ],
      } as unknown as TmdbAggregateCreditsResponseDto;

      const result = service.mapCredits(input);

      expect(result.crew[0].job).toBe('Director');
    });

    it('should handle missing cast and crew gracefully', () => {
      const input = { id: 1 } as unknown as TmdbCreditsResponseDto;

      const result = service.mapCredits(input);

      expect(result.cast).toEqual([]);
      expect(result.crew).toEqual([]);
    });
  });

  describe('mapPerson', () => {
    it('should map all snake_case fields to camelCase', () => {
      const input = {
        id: 1,
        also_known_as: ['Name 1'],
        known_for_department: 'Acting',
        place_of_birth: 'New York',
        profile_path: '/profile.jpg',
        imdb_id: 'nm1234567',
      } as unknown as TmdbPersonResponseDto;

      const result = service.mapPerson(input);

      expect(result.alsoKnownAs).toEqual(['Name 1']);
      expect(result.knownForDepartment).toBe('Acting');
      expect(result.placeOfBirth).toBe('New York');
      expect(result.profilePath).toBe('/profile.jpg');
      expect(result.imdbId).toBe('nm1234567');
    });
  });

  describe('mapTvShowDetails', () => {
    it('should map snake_case fields to camelCase', () => {
      const input = {
        id: 1,
        backdrop_path: '/backdrop.jpg',
        first_air_date: '2024-01-01',
        last_air_date: '2024-12-01',
        in_production: true,
        number_of_episodes: 10,
        number_of_seasons: 2,
        origin_country: ['US'],
        original_language: 'en',
        original_name: 'Original Name',
        poster_path: '/poster.jpg',
        vote_average: 8.0,
        vote_count: 500,
        episode_run_time: [45],
        created_by: [],
        production_companies: [],
        production_countries: [],
        spoken_languages: [],
        seasons: [],
        external_ids: { imdb_id: 'tt7654321' },
      } as unknown as TmdbTvShowDetailsResponseDto;

      const result = service.mapTvShowDetails(input);

      expect(result.backdropPath).toBe('/backdrop.jpg');
      expect(result.firstAirDate).toBe('2024-01-01');
      expect(result.inProduction).toBe(true);
      expect(result.numberOfEpisodes).toBe(10);
      expect(result.numberOfSeasons).toBe(2);
      expect(result.originalName).toBe('Original Name');
      expect(result.imdbId).toBe('tt7654321');
    });

    it('should handle missing arrays gracefully', () => {
      const input = {
        external_ids: {},
      } as unknown as TmdbTvShowDetailsResponseDto;

      const result = service.mapTvShowDetails(input);

      expect(result.createdBy).toEqual([]);
      expect(result.productionCompanies).toEqual([]);
      expect(result.seasons).toEqual([]);
    });
  });
});
