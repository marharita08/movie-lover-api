import { MediaType } from 'src/entities';

export interface AIRecommendationItemDto {
  title: string;
  original_title: string | null;
  year: number | null;
  type: MediaType;
}
