export interface PersonResponseDto {
  adult: boolean;
  alsoKnownAs: string[];
  biography: string;
  birthday: string | null;
  deathday: string | null;
  gender: number;
  homepage: string | null;
  id: number;
  imdbId: string | null;
  knownForDepartment: string;
  name: string;
  placeOfBirth: string | null;
  popularity: number;
  profilePath: string | null;
}
