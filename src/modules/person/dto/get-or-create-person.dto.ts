export type GetOrCreatePersonDto = {
  tmdbId: number;
  imdbId?: string | null;
  name: string;
  profilePath?: string | null;
};
