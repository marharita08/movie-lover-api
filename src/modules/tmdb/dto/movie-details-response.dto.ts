export interface CollectionDto {
  id: number;
  name: string;
  posterPath: string | null;
  backdropPath: string | null;
}

export interface MovieDetailsResponseDto {
  adult: boolean;
  backdropPath: string | null;
  belongsToCollection: CollectionDto | null;
  budget: number;
  genres: {
    id: number;
    name: string;
  }[];
  homepage: string | null;
  id: number;
  imdbId: string | null;
  originalLanguage: string;
  originalTitle: string;
  overview: string | null;
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
  releaseDate: string | null;
  revenue: number;
  runtime: number | null;
  spokenLanguages: {
    iso6391: string;
    name: string;
    englishName: string;
  }[];
  status: string;
  tagline: string | null;
  title: string;
  video: boolean;
  voteAverage: number;
  voteCount: number;
}
