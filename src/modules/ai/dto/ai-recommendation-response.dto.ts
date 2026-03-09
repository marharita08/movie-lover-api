import { AIRecommendationItemDto } from './ai-recommendation-item.dto';

export interface AIRecommendationResponseDto {
  text: string;
  recommendations: AIRecommendationItemDto[];
}
