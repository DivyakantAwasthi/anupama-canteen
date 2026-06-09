const ORDERS_API_URL = String(process.env.ORDERS_API_URL || "").trim();
const MONITOR_PASSWORD = String(process.env.KITCHEN_MONITOR_PASSWORD || "").trim();
const INDIA_TIME_ZONE = "Asia/Kolkata";

const normalizeStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const map = {
    pending: "pending",
    pending_payment: "pending",
    awaiting_payment: "pending",
    payment_verified: "pending",
    paid: "pending",
    preparing: "preparing",
    cooking: "preparing",
    ready: "ready",
    ready_for_pickup: "ready",
    delivered: "delivered",
    completed: "delivered",
    cancelled: "delivered",
    canceled: "delivered",
  };

  return map[normalized] || "";
};

const getIndiaDateKey = (value = new Date()) => {
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: INDIA_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  } catch {
    return "";
  }
};

const normalizeDateKey = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
  }
  return getIndiaDateKey(raw);
};

const fetchJson = async (url, options = {}, timeoutMs = 10000) => {
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

const assertAuthorized = (req, res) => {
  if (!MONITOR_PASSWORD) {
    return true;
  }
  const provided = String(req.headers["x-monitor-password"] || "").trim();
  if (provided === MONITOR_PASSWORD) {
    return true;
  }
  res.status(401).json({ error: "unauthorized" });
  return false;
};

const handler = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!assertAuthorized(req, res)) {
    return undefined;
  }

  if (!ORDERS_API_URL) {
    return res.status(500).json({ error: "orders_api_not_configured" });
  }

  const { orderId, status, timestamp, orderDate } = req.body || {};
  const normalizedStatus = normalizeStatus(status);
  const normalizedDate = normalizeDateKey(orderDate || String(timestamp || "").slice(0, 10));

  if (!orderId || !normalizedStatus) {
    return res.status(400).json({ error: "invalid_status_payload" });
  }

  const payload = {
    action: "updateOrderStatus",
    orderId: String(orderId).trim(),
    id: String(orderId).trim(),
    status: normalizedStatus,
    orderStatus: normalizedStatus,
    orderDate: normalizedDate,
    date: normalizedDate,
    timestamp: String(timestamp || ""),
    source: "kitchen_panel",
  };

  console.log("[UpdateOrderStatus] Received request", { payload });

  try {
    const responsePayload = await fetchJson(ORDERS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }, 10000);

    if (responsePayload?.ok === false || responsePayload?.success === false || responsePayload?.error) {
      const errorMessage = responsePayload.error || responsePayload.message || "update_failed";
      console.error("[UpdateOrderStatus] API returned error", { responsePayload });
      return res.status(502).json({ error: errorMessage, detail: responsePayload });
    }

    console.log("[UpdateOrderStatus] Google Apps Script response", { responsePayload });
    return res.status(200).json({ ok: true, success: true, orderId: String(orderId).trim(), status: normalizedStatus });
  } catch (error) {
    console.error("[UpdateOrderStatus] Proxy failed", { error: String(error) });
    return res.status(502).json({ ok: false, success: false, error: "status_update_failed", detail: String(error) });
  }
};

module.exports = handler;
