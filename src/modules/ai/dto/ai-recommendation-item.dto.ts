import { MediaType } from 'src/entities';

export interface AIRecommendationItemDto {
  title: string;
  year: number;
  type: MediaType;
}
