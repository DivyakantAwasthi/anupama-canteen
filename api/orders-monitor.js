const ORDERS_API_URL = String(
  process.env.ORDERS_API_URL ||
    process.env.REACT_APP_ORDERS_API_URL ||
    process.env.REACT_APP_MENU_API_URL ||
    ""
).trim();

const MONITOR_PASSWORD = String(process.env.KITCHEN_MONITOR_PASSWORD || "").trim();
const LIST_ACTIONS = String(
  process.env.ORDERS_LIST_ACTIONS || "listOrders,getOrders,orders,recentOrders,kitchenOrders"
)
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const UPDATE_ACTIONS = String(
  process.env.ORDERS_UPDATE_ACTIONS || "updateOrderStatus,setOrderStatus,updateStatus"
)
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));
const INDIA_TIME_ZONE = "Asia/Kolkata";

const hasConfiguredValue = (value) =>
  typeof value === "string" &&
  value.trim() !== "" &&
  !value.startsWith("YOUR_") &&
  !value.includes("<");

const pickField = (source, keys, fallback = "") => {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return fallback;
};

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
  };

  return map[normalized] || "pending";
};

const normalizeItems = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        const name = pickField(item, ["name", "Name", "item", "Item"], "Item");
        const quantity = pickField(item, ["quantity", "qty", "Quantity", "Qty"], "");
        return quantity ? `${name} x${quantity}` : String(name);
      })
      .filter(Boolean)
      .join(", ");
  }

  return String(value || "");
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

const getOrderKey = (order) => String(`${order.orderDate || ""}:${order.orderId || ""}`).trim();

const normalizeOrder = (rawOrder) => {
  if (!rawOrder || typeof rawOrder !== "object") {
    return null;
  }

  const orderId = String(
    pickField(rawOrder, ["orderId", "Order ID", "OrderId", "id", "ID", "order_id"], "")
  ).trim();

  if (!orderId) {
    return null;
  }

  const rawOrderDate = pickField(rawOrder, ["orderDate", "Order Date", "order_date"], "");
  const timestamp = String(
    pickField(rawOrder, ["timestamp", "Timestamp", "createdAt", "time", "Time", "date", "Date"], "")
  );
  const orderDate = normalizeDateKey(rawOrderDate) || normalizeDateKey(timestamp);

  return {
    orderId,
    orderDate,
    orderKey: getOrderKey({ orderId, orderDate }),
    customerName: String(
      pickField(rawOrder, ["customerName", "Customer Name", "customer", "name", "Name"], "")
    ),
    items: normalizeItems(
      pickField(rawOrder, ["items", "Items", "orderItems", "Order Items", "item"], "")
    ),
    total: Number(pickField(rawOrder, ["total", "Total", "amount", "Amount"], 0)) || 0,
    timestamp,
    status: normalizeStatus(
      pickField(rawOrder, ["status", "Status", "orderStatus", "order_status"], "")
    ),
  };
};

const dedupeOrdersById = (orders) => {
  const uniqueOrders = new Map();

  orders.forEach((order) => {
    const key = getOrderKey(order);
    if (!key) {
      return;
    }

    const existing = uniqueOrders.get(key);
    if (!existing || parseTimeValue(order.timestamp) > parseTimeValue(existing.timestamp)) {
      uniqueOrders.set(key, order);
    }
  });

  return Array.from(uniqueOrders.values());
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

  return candidates.map(normalizeOrder).filter(Boolean);
};

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

const listOrders = async (req, res) => {
  const errors = [];
  const selectedDate = normalizeDateKey(req.query?.date || req.query?.orderDate) || getIndiaDateKey();

  for (const action of LIST_ACTIONS) {
    try {
      const url = new URL(ORDERS_API_URL);
      url.searchParams.set("action", action);
      url.searchParams.set("limit", "100");
      url.searchParams.set("date", selectedDate);
      url.searchParams.set("orderDate", selectedDate);

      const payload = await fetchJson(url.toString(), { method: "GET", headers: { Accept: "application/json" } });
      const orders = dedupeOrdersById(extractOrders(payload).filter((order) => order.orderDate === selectedDate));
      if (orders.length || payload?.ok === true || payload?.success === true) {
        return res.status(200).json({ ok: true, selectedDate, orders });
      }
    } catch (error) {
      errors.push(`${action}: ${error?.message || "failed"}`);
      await sleep(150);
    }
  }

  return res.status(502).json({ error: "orders_upstream_failed", detail: errors.join(" | ") });
};

const updateOrderStatus = async (req, res) => {
  const { orderId, status, timestamp, orderDate } = req.body || {};
  const normalizedStatus = normalizeStatus(status);

  if (!orderId || !["pending", "preparing", "ready", "delivered"].includes(normalizedStatus)) {
    return res.status(400).json({ error: "invalid_status_payload" });
  }

  console.log('[StatusUpdate] Updating order:', { orderId, status: normalizedStatus, orderDate, timestamp });
  const errors = [];
  const payload = {
    action: "updateOrderStatus",
    orderId: String(orderId),
    id: String(orderId),
    timestamp: String(timestamp || ""),
    orderDate: String(orderDate || String(timestamp || "").slice(0, 10)),
    date: String(orderDate || String(timestamp || "").slice(0, 10)),
    status: normalizedStatus,
    orderStatus: normalizedStatus,
  };

  for (const action of UPDATE_ACTIONS) {
    const finalPayload = { ...payload, action };
    const body = new URLSearchParams(finalPayload).toString();

    try {
      console.log('[StatusUpdate] Attempt with action:', action);
      const responsePayload = await fetchJson(
        ORDERS_API_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            Accept: "application/json",
          },
          body,
        },
        7000
      );

      if (responsePayload?.ok === false || responsePayload?.success === false || responsePayload?.error) {
        throw new Error(responsePayload.error || responsePayload.message || "update rejected");
      }

      console.log('[StatusUpdate] Success with action:', action, { response: responsePayload });
      return res.status(200).json({ ok: true, orderId: String(orderId), status: normalizedStatus });
    } catch (error) {
      console.log('[StatusUpdate] Failed with action:', action, { error: error?.message });
      errors.push(`${action}: ${error?.message || "failed"}`);
      await sleep(150);
    }
  }

  console.log('[StatusUpdate] All attempts failed:', errors);
  return res.status(502).json({ error: "status_update_failed", detail: errors.join(" | ") });
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!assertAuthorized(req, res)) {
    return undefined;
  }

  if (!hasConfiguredValue(ORDERS_API_URL)) {
    return res.status(500).json({ error: "orders_api_not_configured" });
  }

  if (req.method === "GET") {
    return listOrders(req, res);
  }

  return updateOrderStatus(req, res);
};
