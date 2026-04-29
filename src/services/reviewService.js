const REVIEWS_ENDPOINT =
  process.env.REACT_APP_REVIEWS_ENDPOINT || "/api/reviews";
const REVIEWS_CACHE_KEY = "anupama:reviews:cache:v1";

let inFlightReviewsRequest = null;

const parseReview = (rawReview) => {
  if (!rawReview || typeof rawReview !== "object") {
    return null;
  }

  const id = String(rawReview.id || "").trim() || `review-${Date.now()}`;
  const name = String(rawReview.name || "Anonymous").trim() || "Anonymous";
  const rating = Math.max(1, Math.min(5, Number(rawReview.rating || 0) || 0));
  const comment = String(rawReview.comment || "").trim();
  if (!rating || !comment) {
    return null;
  }

  return {
    id,
    name,
    rating,
    comment,
    date: String(rawReview.date || "").trim() || new Date().toISOString().slice(0, 10),
    helpfulCount: Math.max(0, Number(rawReview.helpfulCount || 0) || 0),
  };
};

const normalizeReviewsByItem = (payload, itemIds = []) => {
  const mapped =
    payload && typeof payload === "object" && payload.reviewsByItem && typeof payload.reviewsByItem === "object"
      ? payload.reviewsByItem
      : {};

  const result = {};
  itemIds.forEach((itemId) => {
    const normalizedId = String(itemId);
    const source = Array.isArray(mapped[normalizedId]) ? mapped[normalizedId] : [];
    result[normalizedId] = source.map(parseReview).filter(Boolean);
  });
  return result;
};

export async function fetchReviewsByItemIds(itemIds = []) {
  const normalizedIds = [...new Set(itemIds.map((id) => String(id).trim()).filter(Boolean))];
  if (!normalizedIds.length) {
    return {};
  }

  try {
    const cached = JSON.parse(localStorage.getItem(REVIEWS_CACHE_KEY) || "{}");
    const cacheKey = normalizedIds.join(",");
    if (cached[cacheKey]) {
      return cached[cacheKey];
    }
  } catch {
    // Ignore cache read errors.
  }

  if (inFlightReviewsRequest) {
    return inFlightReviewsRequest;
  }

  inFlightReviewsRequest = (async () => {
    const response = await fetch(
      `${REVIEWS_ENDPOINT}?itemIds=${encodeURIComponent(normalizedIds.join(","))}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Unable to fetch reviews (HTTP ${response.status}) ${text}`.trim());
    }

    const payload = await response.json();
    const normalized = normalizeReviewsByItem(payload, normalizedIds);

    try {
      const cacheKey = normalizedIds.join(",");
      const cached = JSON.parse(localStorage.getItem(REVIEWS_CACHE_KEY) || "{}");
      cached[cacheKey] = normalized;
      localStorage.setItem(REVIEWS_CACHE_KEY, JSON.stringify(cached));
    } catch {
      // Ignore cache write errors.
    }

    return normalized;
  })();

  try {
    return await inFlightReviewsRequest;
  } finally {
    inFlightReviewsRequest = null;
  }
}

export async function saveReviewForItem({ itemId, review }) {
  const normalizedItemId = String(itemId || "").trim();
  if (!normalizedItemId) {
    throw new Error("itemId is required");
  }

  const normalizedReview = parseReview(review);
  if (!normalizedReview) {
    throw new Error("Invalid review payload");
  }

  const response = await fetch(REVIEWS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      itemId: normalizedItemId,
      review: normalizedReview,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Unable to save review (HTTP ${response.status})`);
  }

  return {
    ok: true,
    review: parseReview(payload?.review) || normalizedReview,
  };
}
