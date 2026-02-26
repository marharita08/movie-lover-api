export interface TvShowResponseDto {
  backdropPath: string | null;
  firstAirDate: string;
  genreIds: number[];
  id: number;
  name: string;
  originCountry: string[];
  originalLanguage: string;
  originalName: string;
  overview: string;
  popularity: number;
  posterPath: string | null;
  voteAverage: number;
  voteCount: number;
}
