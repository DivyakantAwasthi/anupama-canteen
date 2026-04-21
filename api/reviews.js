const DEFAULT_LIST_ACTIONS = ["listReviews", "reviews", "getReviews"];
const DEFAULT_APPEND_ACTIONS = ["appendReview", "addReview", "review"];

const getConfiguredReviewsApiUrl = () => {
  const candidates = [
    process.env.REVIEWS_API_URL,
    process.env.ORDERS_API_URL,
    process.env.REACT_APP_REVIEWS_API_URL,
    process.env.REACT_APP_ORDERS_API_URL,
  ];

  return candidates
    .map((value) => String(value || "").trim())
    .find((value) => value && !value.startsWith("YOUR_") && !value.includes("<"));
};

const parseActionList = (envValue, fallback) => {
  const raw = String(envValue || "").trim();
  if (!raw) {
    return fallback;
  }
  const actions = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return actions.length ? actions : fallback;
};

const toSafeString = (value) => String(value == null ? "" : value).trim();

const normalizeReview = (rawReview) => {
  if (!rawReview || typeof rawReview !== "object") {
    return null;
  }

  const rating = Number(rawReview.rating || 0);
  const comment = toSafeString(rawReview.comment);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5 || !comment) {
    return null;
  }

  return {
    id: toSafeString(rawReview.id) || `review-${Date.now()}`,
    name: toSafeString(rawReview.name) || "Anonymous",
    rating: Math.round(rating),
    comment,
    date: toSafeString(rawReview.date) || new Date().toISOString().slice(0, 10),
    helpfulCount: Math.max(0, Number(rawReview.helpfulCount || 0) || 0),
  };
};

const normalizeRowToReview = (rawRow) => {
  if (!rawRow || typeof rawRow !== "object") {
    return null;
  }

  const itemId = toSafeString(rawRow.itemId || rawRow.item_id || rawRow.item || rawRow.menuItemId);
  const review = normalizeReview({
    id: rawRow.id || rawRow.reviewId || rawRow.review_id,
    name: rawRow.name || rawRow.author || rawRow.user,
    rating: rawRow.rating,
    comment: rawRow.comment || rawRow.review || rawRow.text,
    date: rawRow.date || rawRow.createdAt || rawRow.timestamp,
    helpfulCount: rawRow.helpfulCount || rawRow.helpful || rawRow.likes,
  });

  if (!itemId || !review) {
    return null;
  }

  return { itemId, review };
};

const parseReviewPayload = (payload) => {
  const result = {};

  if (payload && typeof payload === "object" && payload.reviewsByItem && typeof payload.reviewsByItem === "object") {
    Object.entries(payload.reviewsByItem).forEach(([itemId, reviews]) => {
      const normalized = Array.isArray(reviews) ? reviews.map(normalizeReview).filter(Boolean) : [];
      result[String(itemId)] = normalized;
    });
    return result;
  }

  const rows = [];
  if (Array.isArray(payload)) {
    rows.push(...payload);
  } else if (payload && typeof payload === "object") {
    if (Array.isArray(payload.items)) {
      rows.push(...payload.items);
    }
    if (Array.isArray(payload.reviews)) {
      rows.push(...payload.reviews);
    }
    if (Array.isArray(payload.data)) {
      rows.push(...payload.data);
    }
  }

  rows.forEach((row) => {
    const parsed = normalizeRowToReview(row);
    if (!parsed) {
      return;
    }
    const itemId = String(parsed.itemId);
    if (!result[itemId]) {
      result[itemId] = [];
    }
    result[itemId].push(parsed.review);
  });

  return result;
};

const readJson = async (response) => {
  const text = await response.text().catch(() => "");
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const fetchReviewsFromUpstream = async ({ upstreamUrl, itemIds, actions }) => {
  const attempts = [];

  for (const action of actions) {
    try {
      const url = new URL(upstreamUrl);
      url.searchParams.set("action", action);
      if (itemIds.length) {
        url.searchParams.set("itemIds", itemIds.join(","));
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
      const payload = await readJson(response);
      if (!response.ok) {
        attempts.push(`${action}: HTTP ${response.status}`);
        continue;
      }
      if (payload && payload.ok === false) {
        attempts.push(`${action}: ${payload.message || payload.error || "failed"}`);
        continue;
      }

      return { ok: true, reviewsByItem: parseReviewPayload(payload || {}) };
    } catch (error) {
      attempts.push(`${action}: ${error?.message || "network_error"}`);
    }
  }

  return { ok: false, detail: attempts.join(" | ") || "unable_to_fetch_reviews" };
};

const appendReviewToUpstream = async ({ upstreamUrl, reviewItem, actions }) => {
  const attempts = [];
  const payload = {
    itemId: reviewItem.itemId,
    id: reviewItem.review.id,
    name: reviewItem.review.name,
    rating: String(reviewItem.review.rating),
    comment: reviewItem.review.comment,
    date: reviewItem.review.date,
    helpfulCount: String(reviewItem.review.helpfulCount || 0),
  };

  for (const action of actions) {
    const bodyPayload = { action, ...payload };
    const formBody = new URLSearchParams(bodyPayload).toString();

    const requestVariants = [
      {
        label: `${action}:POST-form`,
        request: () =>
          fetch(upstreamUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
              Accept: "application/json",
            },
            body: formBody,
          }),
      },
      {
        label: `${action}:POST-json`,
        request: () =>
          fetch(upstreamUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(bodyPayload),
          }),
      },
    ];

    for (const variant of requestVariants) {
      try {
        const response = await variant.request();
        const result = await readJson(response);
        if (!response.ok) {
          attempts.push(`${variant.label}:HTTP ${response.status}`);
          continue;
        }
        if (result && result.ok === false) {
          attempts.push(`${variant.label}:${result.message || result.error || "failed"}`);
          continue;
        }
        return { ok: true };
      } catch (error) {
        attempts.push(`${variant.label}:${error?.message || "network_error"}`);
      }
    }
  }

  return { ok: false, detail: attempts.join(" | ") || "unable_to_save_review" };
};

module.exports = async (req, res) => {
  const upstreamUrl = getConfiguredReviewsApiUrl();
  if (!upstreamUrl) {
    return res.status(500).json({
      error: "REVIEWS_API_URL_not_configured",
      detail: "Configure REVIEWS_API_URL (or reuse ORDERS_API_URL) to enable shared reviews.",
    });
  }

  if (req.method === "GET") {
    const itemIdsRaw = toSafeString(req.query?.itemIds);
    const itemIds = itemIdsRaw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const listActions = parseActionList(process.env.REVIEWS_LIST_ACTIONS, DEFAULT_LIST_ACTIONS);
    const fetched = await fetchReviewsFromUpstream({
      upstreamUrl,
      itemIds,
      actions: listActions,
    });

    if (!fetched.ok) {
      return res.status(502).json({
        error: "reviews_upstream_failed",
        detail: fetched.detail,
      });
    }

    const reviewsByItem = fetched.reviewsByItem || {};
    itemIds.forEach((itemId) => {
      if (!Array.isArray(reviewsByItem[itemId])) {
        reviewsByItem[itemId] = [];
      }
    });

    return res.status(200).json({ ok: true, reviewsByItem });
  }

  if (req.method === "POST") {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const itemId = toSafeString(body.itemId);
    const review = normalizeReview(body.review);

    if (!itemId || !review) {
      return res.status(400).json({ error: "invalid_review_payload" });
    }

    const appendActions = parseActionList(process.env.REVIEWS_APPEND_ACTIONS, DEFAULT_APPEND_ACTIONS);
    const saved = await appendReviewToUpstream({
      upstreamUrl,
      reviewItem: { itemId, review },
      actions: appendActions,
    });

    if (!saved.ok) {
      return res.status(502).json({
        error: "review_save_failed",
        detail: saved.detail,
      });
    }

    return res.status(200).json({
      ok: true,
      itemId,
      review,
    });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "method_not_allowed" });
};
