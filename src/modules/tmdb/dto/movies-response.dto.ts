export interface MovieDto {
  adult: boolean;
  backdropPath: string | null;
  genreIds: number[];
  id: number;
  originalLanguage: string;
  originalTitle: string;
  overview: string;
  popularity: number;
  posterPath: string | null;
  releaseDate: string | null;
  title: string;
  video: boolean;
  voteAverage: number;
  voteCount: number;
}

export interface MoviesResponseDto {
  page: number;
  results: MovieDto[];
  totalPages: number;
  totalResults: number;
}
