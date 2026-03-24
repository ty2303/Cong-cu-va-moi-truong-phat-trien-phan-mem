export type ReviewSentiment = 'positive' | 'negative' | 'neutral';

export interface ReviewAnalysisResult {
  aspect: string;
  sentiment: ReviewSentiment;
  confidence: number;
}

export interface ReviewSentimentStat {
  sentiment: ReviewSentiment;
  label: string;
  count: number;
  ratio: number;
  percentageLabel: string;
  color: string;
  textColor: string;
  bgColor: string;
}

export interface ReviewSentimentProductSummary {
  productId: string;
  productName: string;
  totalMentions: number;
  dominantSentiment: ReviewSentiment | null;
  positive: number;
  negative: number;
  neutral: number;
  positiveRatio: number;
  negativeRatio: number;
  neutralRatio: number;
}

export interface ReviewSentimentSummary {
  totalMentions: number;
  reviewCount: number;
  analyzedReviewCount: number;
  dominantSentiment: ReviewSentiment | null;
  stats: ReviewSentimentStat[];
  productSummaries: ReviewSentimentProductSummary[];
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
