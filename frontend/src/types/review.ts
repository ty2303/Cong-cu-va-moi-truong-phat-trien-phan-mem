export interface ReviewAnalysisResult {
  aspect: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  username: string;
  rating: number;
  comment: string;
  images?: string[];
  analysisResults?: ReviewAnalysisResult[];
  createdAt: string;
  updatedAt?: string;
}

export interface CreateReviewPayload {
  productId: string;
  rating: number;
  comment: string;
  images?: string[];
}

export type UpdateReviewPayload = CreateReviewPayload;
