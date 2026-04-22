module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const ORDERS_API_URL = "https://script.google.com/macros/s/AKfycbzryN3AnMCu3m2QDT4DerbFepEL2dZuGCynXVzF8QPQ_0NUyoMDJ18GpazFRVs-lFfG4w/exec";

  const REQUEST_TIMEOUT_MS = 5000; // 5 second timeout (reduced from 8)
  const MAX_RETRIES = 2;
  
  console.log(`[API/Menu] Fetching from: ${ORDERS_API_URL}`);

  const fetchWithTimeout = async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    let lastError;
    
    // Retry loop with exponential backoff
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const sourceUrl = new URL(ORDERS_API_URL);
        sourceUrl.searchParams.set("action", "menu");

        console.log(`[API/Menu] Attempt ${attempt}/${MAX_RETRIES} to fetch menu`);

        const upstream = await fetchWithTimeout(sourceUrl.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        const text = await upstream.text().catch(() => "");
        
        if (!upstream.ok) {
          lastError = new Error(`HTTP ${upstream.status}`);
          console.warn(`[API/Menu] HTTP ${upstream.status} response`);
          
          if (attempt < MAX_RETRIES) {
            const delayMs = 500 * Math.pow(2, attempt - 1);
            await sleep(delayMs);
            continue;
          }
          
          return res.status(502).json({
            error: "menu_upstream_failed",
            detail: `HTTP ${upstream.status}`,
          });
        }

        let payload;
        try {
          payload = text ? JSON.parse(text) : [];
        } catch {
          lastError = new Error("invalid_json");
          console.warn("[API/Menu] Invalid JSON response");
          
          if (attempt < MAX_RETRIES) {
            const delayMs = 500 * Math.pow(2, attempt - 1);
            await sleep(delayMs);
            continue;
          }
          
          return res.status(502).json({
            error: "menu_upstream_invalid_json",
          });
        }

        console.log(`[API/Menu] Successfully fetched menu from upstream`);
        console.log(`[API/Menu] Returning ${payload.items ? payload.items.length : Array.isArray(payload) ? payload.length : 0} items`);
        return res.status(200).json(payload);
      } catch (error) {
        lastError = error;
        console.warn(`[API/Menu] Attempt ${attempt} failed:`, error?.message);
        
        if (attempt < MAX_RETRIES) {
          const delayMs = 500 * Math.pow(2, attempt - 1);
          await sleep(delayMs);
        }
      }
    }

    // All retries exhausted
    console.error("[API/Menu] All retry attempts failed", lastError?.message);
    return res.status(503).json({
      error: "menu_fetch_failed_all_attempts",
      detail: lastError?.message || "unknown_error",
    });
  } catch (error) {
    console.error("[API/Menu] Unexpected error:", error?.message);
    return res.status(500).json({
      error: "server_error",
      detail: error?.message || "unknown_error",
    });
  }
};
