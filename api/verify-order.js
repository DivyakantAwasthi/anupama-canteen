/**
 * Verify Order Endpoint
 * Checks if a specific order exists in Google Sheets
 * Returns 200 if exists, 404 if not found
 * 
 * Usage: GET /api/verify-order?orderId=123&date=2026-05-19
 */

const ORDERS_API_URL = String(
  process.env.ORDERS_API_URL ||
    process.env.REACT_APP_ORDERS_API_URL ||
    ""
).trim();

const LIST_ACTIONS = String(
  process.env.ORDERS_LIST_ACTIONS || "listOrders,getOrders,orders,recentOrders,kitchenOrders"
)
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const fetchJson = async (url, options = {}, timeoutMs = 7000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${text}`.trim());
    }

    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeoutId);
  }
};

const extractOrders = (payload) => {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.orders)
      ? payload.orders
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.result)
            ? payload.result
            : [];

  return candidates.map(o => ({
    orderId: String(o?.orderId || o?.id || "").trim(),
    date: String(o?.orderDate || o?.date || "").trim(),
  })).filter(o => o.orderId);
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { orderId, date } = req.query;

  if (!orderId) {
    return res.status(400).json({ error: "orderId_required" });
  }

  if (!ORDERS_API_URL) {
    return res.status(500).json({ error: "orders_api_not_configured" });
  }

  console.log('[VerifyOrder] Checking order:', { orderId, date });

  const errors = [];

  for (const action of LIST_ACTIONS) {
    try {
      const url = new URL(ORDERS_API_URL);
      url.searchParams.set("action", action);
      url.searchParams.set("limit", "100");
      if (date) {
        url.searchParams.set("date", date);
        url.searchParams.set("orderDate", date);
      }

      const payload = await fetchJson(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const orders = extractOrders(payload);
      const found = orders.find(o => String(o.orderId) === String(orderId));

      if (found || payload?.ok === true || payload?.success === true) {
        console.log('[VerifyOrder] Order found:', { orderId });
        return res.status(200).json({
          ok: true,
          exists: !!found,
          orderId: String(orderId),
        });
      }
    } catch (error) {
      console.log('[VerifyOrder] Action failed:', { action, error: error?.message });
      errors.push(`${action}: ${error?.message || "failed"}`);
      await sleep(100);
    }
  }

  console.log('[VerifyOrder] Order not found:', { orderId, errors });
  return res.status(404).json({
    ok: false,
    exists: false,
    orderId: String(orderId),
    detail: errors.join(" | "),
  });
};
