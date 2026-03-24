import type {
  Review,
  ReviewSentiment,
  ReviewSentimentProductSummary,
  ReviewSentimentStat,
  ReviewSentimentSummary,
} from '@/types/review';

const SENTIMENT_ORDER: ReviewSentiment[] = ['positive', 'neutral', 'negative'];

const SENTIMENT_META: Record<
  ReviewSentiment,
  {
    label: string;
    color: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  positive: {
    label: 'Tích cực',
    color: '#10b981',
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  neutral: {
    label: 'Trung lập',
    color: '#64748b',
    textColor: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
  },
  negative: {
    label: 'Tiêu cực',
    color: '#ef4444',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
};

type ProductLookup = Map<string, { name: string }>;

export function getSentimentLabel(sentiment: ReviewSentiment) {
  return SENTIMENT_META[sentiment].label;
}

export function getSentimentColor(sentiment: ReviewSentiment) {
  return SENTIMENT_META[sentiment].color;
}

export function getSentimentBadgeClass(sentiment: ReviewSentiment) {
  const meta = SENTIMENT_META[sentiment];
  return `${meta.borderColor} ${meta.bgColor} ${meta.textColor}`;
}

export function buildReviewSentimentSummary(
  reviews: Review[],
  productLookup?: ProductLookup,
): ReviewSentimentSummary {
  const counts = {
    positive: 0,
    neutral: 0,
    negative: 0,
  } satisfies Record<ReviewSentiment, number>;
  const productCounter = new Map<
    string,
    Record<ReviewSentiment, number> & { totalMentions: number }
  >();

  let totalMentions = 0;
  let analyzedReviewCount = 0;

  reviews.forEach((review) => {
    const results = review.analysisResults ?? [];
    if (results.length > 0) {
      analyzedReviewCount += 1;
    }

    results.forEach((result) => {
      counts[result.sentiment] += 1;
      totalMentions += 1;

      const current = productCounter.get(review.productId) ?? {
        positive: 0,
        neutral: 0,
        negative: 0,
        totalMentions: 0,
      };

      current[result.sentiment] += 1;
      current.totalMentions += 1;
      productCounter.set(review.productId, current);
    });
  });

  const stats: ReviewSentimentStat[] = SENTIMENT_ORDER.map((sentiment) => {
    const count = counts[sentiment];
    const ratio = totalMentions > 0 ? count / totalMentions : 0;

    return {
      sentiment,
      label: getSentimentLabel(sentiment),
      count,
      ratio,
      percentageLabel: `${Math.round(ratio * 100)}%`,
      color: getSentimentColor(sentiment),
      textColor: SENTIMENT_META[sentiment].textColor,
      bgColor: SENTIMENT_META[sentiment].bgColor,
    };
  });

  const dominantSentiment =
    totalMentions > 0
      ? ([...stats].sort((first, second) => second.count - first.count)[0]
          ?.sentiment ?? null)
      : null;

  const productSummaries: ReviewSentimentProductSummary[] = Array.from(
    productCounter.entries(),
  )
    .map(([productId, counter]) => {
      const productName =
        productLookup?.get(productId)?.name ?? `Sản phẩm ${productId}`;
      const positiveRatio =
        counter.totalMentions > 0
          ? counter.positive / counter.totalMentions
          : 0;
      const neutralRatio =
        counter.totalMentions > 0 ? counter.neutral / counter.totalMentions : 0;
      const negativeRatio =
        counter.totalMentions > 0
          ? counter.negative / counter.totalMentions
          : 0;
      const dominantProductSentiment =
        counter.totalMentions > 0
          ? ((
              [
                ['positive', counter.positive],
                ['neutral', counter.neutral],
                ['negative', counter.negative],
              ] as Array<[ReviewSentiment, number]>
            ).sort((first, second) => second[1] - first[1])[0]?.[0] ?? null)
          : null;

      return {
        productId,
        productName,
        totalMentions: counter.totalMentions,
        dominantSentiment: dominantProductSentiment,
        positive: counter.positive,
        neutral: counter.neutral,
        negative: counter.negative,
        positiveRatio,
        neutralRatio,
        negativeRatio,
      };
    })
    .sort((first, second) => {
      if (second.totalMentions !== first.totalMentions) {
        return second.totalMentions - first.totalMentions;
      }

      return second.positiveRatio - first.positiveRatio;
    });

  return {
    totalMentions,
    reviewCount: reviews.length,
    analyzedReviewCount,
    dominantSentiment,
    stats,
    productSummaries,
  };
}

export function buildSentimentDonutStyle(stats: ReviewSentimentStat[]) {
  const positive =
    stats.find((item) => item.sentiment === 'positive')?.ratio ?? 0;
  const neutral =
    stats.find((item) => item.sentiment === 'neutral')?.ratio ?? 0;
  const positiveEnd = positive * 100;
  const neutralEnd = positiveEnd + neutral * 100;
  const hasData = stats.some((item) => item.count > 0);

  return hasData
    ? {
        backgroundImage: `conic-gradient(
          ${getSentimentColor('positive')} 0% ${positiveEnd}%,
          ${getSentimentColor('neutral')} ${positiveEnd}% ${neutralEnd}%,
          ${getSentimentColor('negative')} ${neutralEnd}% 100%
        )`,
      }
    : {
        backgroundImage:
          'conic-gradient(#e2e8f0 0% 100%, #e2e8f0 0% 100%, #e2e8f0 0% 100%)',
      };
}
