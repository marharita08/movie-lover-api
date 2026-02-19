export interface CastMemberDto {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
}

export interface CrewMemberDto {
  id: number;
  name: string;
  job: string;
  department: string;
  profilePath: string | null;
}

export interface CreditsResponseDto {
  id: number;
  cast: CastMemberDto[];
  crew: CrewMemberDto[];
}
