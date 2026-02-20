export interface TvShowDetailsResponseDto {
  adult: boolean;
  backdropPath: string | null;
  createdBy: {
    id: number;
    name: string;
    profilePath: string | null;
  }[];
  episodeRunTime: number[];
  firstAirDate: string;
  genres: {
    id: number;
    name: string;
  }[];
  homepage: string;
  id: number;
  inProduction: boolean;
  languages: string[];
  lastAirDate: string;
  name: string;
  numberOfEpisodes: number;
  numberOfSeasons: number;
  originCountry: string[];
  originalLanguage: string;
  originalName: string;
  overview: string;
  popularity: number;
  posterPath: string | null;
  productionCompanies: {
    id: number;
    logoPath: string | null;
    name: string;
    originCountry: string;
  }[];
  productionCountries: {
    iso31661: string;
    name: string;
  }[];
  seasons: {
    airDate: string | null;
    episodeCount: number;
    id: number;
    name: string;
    overview: string;
    posterPath: string | null;
    seasonNumber: number;
    voteAverage: number;
  }[];
  spokenLanguages: {
    englishName: string;
    iso6391: string;
    name: string;
  }[];
  status: string;
  tagline: string;
  type: string;
  voteAverage: number;
  voteCount: number;
  imdbId: string | null;
}
