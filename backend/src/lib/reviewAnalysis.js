const DEFAULT_ABSA_URL = "http://127.0.0.1:9000/predict";
const VALID_SENTIMENTS = new Set(["positive", "negative", "neutral"]);

export async function analyzeReviewComment(comment) {
  const text = String(comment ?? "").trim();

  if (!text) {
    return [];
  }

  try {
    const response = await fetch(process.env.ABSA_SERVICE_URL || DEFAULT_ABSA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.results)) {
      return [];
    }

    return payload.results
      .map(normalizeAnalysisResult)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeAnalysisResult(item) {
  const aspect = String(item?.aspect ?? "").trim();
  const sentiment = String(item?.sentiment ?? "").trim().toLowerCase();
  const confidence = Number(item?.confidence);

  if (!aspect || !VALID_SENTIMENTS.has(sentiment) || !Number.isFinite(confidence)) {
    return null;
  }

  return {
    aspect,
    sentiment,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}
