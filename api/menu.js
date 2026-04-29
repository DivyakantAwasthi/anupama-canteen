const ORDERS_API_URL = String(
  process.env.ORDERS_API_URL ||
    process.env.REACT_APP_MENU_API_URL ||
    "https://script.google.com/macros/s/AKfycbzryN3AnMCu3m2QDT4DerbFepEL2dZuGCynXVzF8QPQ_0NUyoMDJ18GpazFRVs-lFfG4w/exec"
).trim();

const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const fetchJson = async (url, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");

  if (!ORDERS_API_URL) {
    return res.status(500).json({ error: "orders_api_not_configured" });
  }

  const sourceUrl = new URL(ORDERS_API_URL);
  sourceUrl.searchParams.set("action", "menu");
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const payload = await fetchJson(sourceUrl.toString());
      return res.status(200).json(payload);
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await sleep(300);
      }
    }
  }

  return res.status(502).json({
    error: "menu_upstream_failed",
    detail: lastError?.message || "unknown_error",
  });
};
