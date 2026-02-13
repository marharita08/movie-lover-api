export interface MovieDetailsResponseDto {
  adult: boolean;
  backdropPath: string;
  belongsToCollection: any;
  budget: number;
  genres: {
    id: number;
    name: string;
  }[];
  homepage: string;
  id: number;
  imdbId: string;
  originalLanguage: string;
  originalTitle: string;
  overview: string;
  popularity: number;
  posterPath: string;
  productionCompanies: {
    id: number;
    logoPath: string;
    name: string;
    originCountry: string;
  }[];
  productionCountries: {
    iso31661: string;
    name: string;
  }[];
  releaseDate: string;
  revenue: number;
  runtime: number;
  spokenLanguages: {
    iso6391: string;
    name: string;
    englishName: string;
  }[];
  status: string;
  tagline: string;
  title: string;
  video: boolean;
  voteAverage: number;
  voteCount: number;
}
