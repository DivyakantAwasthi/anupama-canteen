/**
 * Health Check Endpoint
 * Verifies that:
 * 1. Vercel deployment is working
 * 2. Backend API is reachable
 * 3. Environment variables are configured
 * 
 * Usage: GET /api/health
 * Returns: JSON with status and upstream connectivity info
 */

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const ORDERS_API_URL = String(
    process.env.ORDERS_API_URL ||
      process.env.REACT_APP_ORDERS_API_URL ||
      process.env.MENU_API_URL ||
      process.env.REACT_APP_MENU_API_URL ||
      ""
  ).trim();

  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    deployment: {
      platform: "Vercel",
      runtime: "Node.js",
      nodeVersion: process.version,
    },
    config: {
      ordersApiConfigured: !!ORDERS_API_URL && !ORDERS_API_URL.startsWith("YOUR_"),
      webhookSecretConfigured: !!process.env.WEBHOOK_SECRET && process.env.WEBHOOK_SECRET !== "change-me",
      reviewsApiConfigured: !!process.env.REVIEWS_API_URL,
      whatsappConfigured: !!process.env.WHATSAPP_API_TOKEN,
    },
    upstream: {
      url: ORDERS_API_URL || "not_configured",
      reachable: false,
      responseTime: null,
      error: null,
    },
  };

  // Test upstream connectivity against the same action used by /api/menu.
  if (ORDERS_API_URL && !ORDERS_API_URL.startsWith("YOUR_")) {
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const upstreamUrl = new URL(ORDERS_API_URL);
      upstreamUrl.searchParams.set("action", "menu");

      const response = await fetch(upstreamUrl.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      health.upstream.reachable = response.ok;
      health.upstream.responseTime = responseTime;

      if (!response.ok) {
        health.upstream.error = `HTTP ${response.status}`;
        health.status = "degraded";
      }
    } catch (error) {
      health.upstream.error = error?.message || "unknown_error";
      health.upstream.reachable = false;
      health.status = "degraded";
    }
  } else {
    health.upstream.error = "API_URL_not_configured";
    health.status = "degraded";
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  return res.status(statusCode).json(health);
};
