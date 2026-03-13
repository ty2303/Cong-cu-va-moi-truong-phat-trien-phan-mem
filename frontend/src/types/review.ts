export interface Review {
  id: string;
  productId: string;
  userId: string;
  username: string;
  rating: number;
  comment: string;
  images?: string[];
  createdAt: string;
}

export interface CreateReviewPayload {
  productId: string;
  rating: number;
  comment: string;
  images?: string[];
}
