export interface TmdbCastMemberDto {
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
  cast_id?: number;
  character: string;
  credit_id: string;
  order: number;
}

export interface TmdbCrewMemberDto {
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
  credit_id: string;
  department: string;
  job: string;
}

export interface TmdbCreditsResponseDto {
  id: number;
  cast: TmdbCastMemberDto[];
  crew: TmdbCrewMemberDto[];
}

export interface TmdbAggregateCastMemberDto {
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
  roles: {
    credit_id: string;
    character: string;
    episode_count: number;
  }[];
  total_episode_count: number;
  order: number;
}

export interface TmdbAggregateCrewMemberDto {
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
  jobs: {
    credit_id: string;
    job: string;
    episode_count: number;
  }[];
  department: string;
  total_episode_count: number;
}

export interface TmdbAggregateCreditsResponseDto {
  id: number;
  cast: TmdbAggregateCastMemberDto[];
  crew: TmdbAggregateCrewMemberDto[];
}
