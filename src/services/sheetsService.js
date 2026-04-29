const ORDERS_API_URL = process.env.REACT_APP_ORDERS_API_URL;
const MENU_API_URL = process.env.REACT_APP_MENU_API_URL || "/api/menu";
const APPEND_ORDER_ENDPOINT =
  process.env.REACT_APP_APPEND_ORDER_ENDPOINT || "/append-order";
const TRACK_ORDER_ACTION = process.env.REACT_APP_TRACK_ORDER_ACTION || "trackOrder";
const ORDER_POST_ACTION = process.env.REACT_APP_ORDER_POST_ACTION || "appendOrder";
const DEFAULT_MENU_IMAGE = "/menu-placeholder.svg";
const MENU_CACHE_KEY = "anupama:menu:cache:v2";
const MENU_CACHE_TTL_MS = 1000 * 60 * 15;

let inFlightMenuRequest = null;
let memoryMenuCache = [];
let memoryMenuCacheAt = 0;

const STABLE_MENU_IMAGE_BY_NAME = {
  "vada pav":
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
  "cheese vada pav":
    "https://raw.githubusercontent.com/DivyakantAwasthi/anupama-canteen/main/public/images/cheese-vada-pav.jpg",
  "club sandwich":
    "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80",
  "cheese sandwich":
    "https://images.unsplash.com/photo-1481070555726-e2fe8357725c?auto=format&fit=crop&w=800&q=80",
  "grilled sandwich":
    "https://raw.githubusercontent.com/DivyakantAwasthi/anupama-canteen/main/public/images/grilled-sandwich.jpg",
  "idli sambhar":
    "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80",
  "2 idli sambhar":
    "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80",
  dosa: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80",
  samosa:
    "https://images.unsplash.com/photo-1601050690117-94f5f6fa0d2b?auto=format&fit=crop&w=800&q=80",
  "samosa cholha":
    "https://images.unsplash.com/photo-1626776876729-bab4369a5a5c?auto=format&fit=crop&w=800&q=80",
  tea: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=800&q=80",
  coffee:
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80",
};

export const FALLBACK_MENU_DATA = [
  { id: "fallback-1", name: "Vada Pav", price: 40, category: "Snacks", active: true },
  { id: "fallback-2", name: "Cheese Vada Pav", price: 50, category: "Snacks", active: true },
  { id: "fallback-3", name: "Club Sandwich", price: 30, category: "Snacks", active: true },
  { id: "fallback-4", name: "Dosa", price: 70, category: "Breakfast", active: true },
  { id: "fallback-5", name: "Tea", price: 20, category: "Beverages", active: true },
  { id: "fallback-6", name: "Veg Noodles Full", price: 70, category: "Meals", active: true },
].map((item, index) => ({
  ...item,
  image: normalizeImageUrl(item.image, item.name),
  id: item.id || `fallback-${index + 1}`,
}));

const hasConfiguredValue = (value) =>
  typeof value === "string" &&
  value.trim() !== "" &&
  !value.startsWith("YOUR_") &&
  !value.includes("<");

const normalizeNameKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

function normalizeImageUrl(value, name) {
  const raw = String(value || "").trim();
  if (!raw) {
    return STABLE_MENU_IMAGE_BY_NAME[normalizeNameKey(name)] || DEFAULT_MENU_IMAGE;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
    }

    if (!["https:", "http:"].includes(parsed.protocol)) {
      return STABLE_MENU_IMAGE_BY_NAME[normalizeNameKey(name)] || DEFAULT_MENU_IMAGE;
    }

    return parsed.toString();
  } catch {
    return STABLE_MENU_IMAGE_BY_NAME[normalizeNameKey(name)] || DEFAULT_MENU_IMAGE;
  }
}

const toBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1;
  }
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "y", "active"].includes(normalized);
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const pickField = (source, keys, fallback = "") => {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return fallback;
};

const normalizeMenuRow = (rawRow, index) => {
  const name = String(pickField(rawRow, ["name", "Name"], "")).trim();
  const price = toNumber(pickField(rawRow, ["price", "Price"], ""));
  const image = String(
    pickField(rawRow, ["image", "Image", "imageUrl", "imageURL"], "")
  ).trim();
  const category = String(
    pickField(rawRow, ["category", "Category", "type", "Type"], "")
  ).trim();
  const active = toBoolean(pickField(rawRow, ["active", "Active"], true));

  if (!name || Number.isNaN(price) || !active) {
    return null;
  }

  return {
    id: String(pickField(rawRow, ["id", "ID", "Id"], index + 1)),
    name,
    price,
    image: normalizeImageUrl(image, name),
    category,
    active,
  };
};

const readCacheRecord = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(MENU_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeCacheRecord = (items) => {
  if (typeof window === "undefined") {
    return;
  }

  const record = {
    items,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage failures and continue with memory cache.
  }
};

export const readCachedMenuItems = () => {
  const record = readCacheRecord();
  if (!record?.items?.length) {
    return [];
  }

  return record.items
    .map((item, index) => normalizeMenuRow(item, index))
    .filter(Boolean);
};

const getMenuCandidates = () => {
  const candidates = [{ label: "menu_proxy", url: "/api/menu" }];

  if (hasConfiguredValue(MENU_API_URL) && String(MENU_API_URL).trim() !== "/api/menu") {
    candidates.push({ label: "menu_env", url: MENU_API_URL });
  }

  if (hasConfiguredValue(ORDERS_API_URL)) {
    candidates.push({ label: "orders_env", url: ORDERS_API_URL });
  }

  return candidates;
};

const fetchJson = async (url, options = {}, timeoutMs = 7000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
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

const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const withRetry = async (task, attempts = 3) => {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(250 * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError;
};

const parseMenuPayload = (payload) => {
  const rows = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
      ? payload
      : [];

  return rows.map((row, index) => normalizeMenuRow(row, index)).filter(Boolean);
};

export async function fetchActiveMenuItems({ force = false } = {}) {
  const cachedRecord = readCacheRecord();
  const hasFreshMemoryCache =
    !force &&
    memoryMenuCache.length > 0 &&
    Date.now() - memoryMenuCacheAt < MENU_CACHE_TTL_MS;

  if (hasFreshMemoryCache) {
    return memoryMenuCache;
  }

  const hasFreshLocalCache =
    !force &&
    cachedRecord?.items?.length &&
    Date.now() - Number(cachedRecord.updatedAt || 0) < MENU_CACHE_TTL_MS;

  if (hasFreshLocalCache) {
    memoryMenuCache = readCachedMenuItems();
    memoryMenuCacheAt = Number(cachedRecord.updatedAt || Date.now());
    return memoryMenuCache;
  }

  if (inFlightMenuRequest && !force) {
    return inFlightMenuRequest;
  }

  inFlightMenuRequest = (async () => {
    const candidates = getMenuCandidates();
    const failures = [];

    for (const candidate of candidates) {
      try {
        const menuUrl = new URL(
          candidate.url,
          typeof window !== "undefined" ? window.location.origin : "http://localhost"
        );
        if (menuUrl.pathname !== "/api/menu") {
          menuUrl.searchParams.set("action", "menu");
        }

        const payload = await withRetry(
          () =>
            fetchJson(menuUrl.toString(), {
              method: "GET",
              headers: { Accept: "application/json" },
            }),
          2
        );

        const normalized = parseMenuPayload(payload);
        if (normalized.length) {
          memoryMenuCache = normalized;
          memoryMenuCacheAt = Date.now();
          writeCacheRecord(normalized);
          return normalized;
        }
      } catch (error) {
        failures.push(`${candidate.label}: ${error?.message || "failed"}`);
      }
    }

    const cached = readCachedMenuItems();
    if (cached.length) {
      memoryMenuCache = cached;
      memoryMenuCacheAt = Date.now();
      return cached;
    }

    if (failures.length) {
      console.warn("[Menu] Using fallback data after failures:", failures.join(" | "));
    }

    return FALLBACK_MENU_DATA;
  })();

  try {
    return await inFlightMenuRequest;
  } finally {
    inFlightMenuRequest = null;
  }
}

const evaluateForwardResponse = async (response) => {
  const text = await response.text().catch(() => "");
  const trimmed = text.trim();

  if (!response.ok) {
    return { ok: false, detail: `HTTP ${response.status} ${trimmed}`.trim() };
  }

  if (!trimmed) {
    return { ok: true, payload: null };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.ok === false || parsed?.success === false || parsed?.error) {
      return { ok: false, detail: parsed.error || parsed.message || trimmed };
    }
    return { ok: true, payload: parsed, detail: trimmed };
  } catch {
    return { ok: !/error|failed|invalid|missing/i.test(trimmed), detail: trimmed };
  }
};

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const extractOrderId = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const direct = [
    value.orderId,
    value.id,
    value.order_id,
    value.orderNumber,
    value.order_number,
    value.sheetOrderId,
  ];

  for (const entry of direct) {
    const parsed = toPositiveInt(entry);
    if (parsed) {
      return parsed;
    }
  }

  return extractOrderId(value.order) || extractOrderId(value.data) || extractOrderId(value.result);
};

const buildOrderPayload = ({
  orderId,
  orderDateKey,
  customerName,
  customerEmail,
  customerPhone,
  items,
  total,
  timestamp,
  status,
}) => ({
  action: ORDER_POST_ACTION,
  orderId: String(orderId),
  orderDate: orderDateKey,
  customerName,
  customerEmail: customerEmail || "",
  customerPhone,
  items,
  total: Number(total).toFixed(2),
  timestamp,
  status,
  name: customerName,
  email: customerEmail || "",
  phone: customerPhone,
});

export async function appendOrderToSheet(orderData) {
  const payload = buildOrderPayload(orderData);
  const attempts = [];

  const proxyRequest = async () => {
    const response = await fetch(APPEND_ORDER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    return evaluateForwardResponse(response);
  };

  try {
    const proxyResult = await withRetry(proxyRequest, 2);
    if (proxyResult.ok) {
      return {
        ok: true,
        orderId: extractOrderId(proxyResult.payload) || toPositiveInt(orderData.orderId),
      };
    }
    attempts.push(`proxy: ${proxyResult.detail}`);
  } catch (error) {
    attempts.push(`proxy: ${error?.message || "network_error"}`);
  }

  if (!hasConfiguredValue(ORDERS_API_URL)) {
    throw new Error(
      `Order could not be synced right now. Please call or WhatsApp us. ${attempts.join(" | ")}`
    );
  }

  const upstreamVariants = [
    {
      label: "form",
      request: () =>
        fetch(ORDERS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: new URLSearchParams(payload).toString(),
        }),
    },
    {
      label: "json",
      request: () =>
        fetch(ORDERS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        }),
    },
    {
      label: "query",
      request: () => {
        const url = new URL(ORDERS_API_URL);
        Object.entries(payload).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
        return fetch(url.toString(), { method: "GET" });
      },
    },
  ];

  for (const variant of upstreamVariants) {
    try {
      const result = await withRetry(async () => {
        const response = await variant.request();
        return evaluateForwardResponse(response);
      }, 2);

      if (result.ok) {
        return {
          ok: true,
          orderId: extractOrderId(result.payload) || toPositiveInt(orderData.orderId),
        };
      }
      attempts.push(`${variant.label}: ${result.detail}`);
    } catch (error) {
      attempts.push(`${variant.label}: ${error?.message || "network_error"}`);
    }
  }

  throw new Error(
    `Order could not be synced right now. Please call or WhatsApp us. ${attempts.join(" | ")}`
  );
}

const normalizeStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const map = {
    pending_payment: "pending_payment",
    awaiting_payment: "pending_payment",
    payment_verified: "payment_verified",
    paid: "payment_verified",
    preparing: "preparing",
    cooking: "preparing",
    ready: "ready_for_pickup",
    ready_for_pickup: "ready_for_pickup",
    delivered: "delivered",
    completed: "delivered",
    cancelled: "cancelled",
    canceled: "cancelled",
  };

  return map[normalized] || normalized;
};

const normalizeTrackedOrder = (rawOrder) => {
  const orderId = toPositiveInt(
    pickField(rawOrder, ["orderId", "Order ID", "id", "OrderId"], null)
  );
  if (!orderId) {
    return null;
  }

  return {
    orderId,
    orderDateKey: String(pickField(rawOrder, ["orderDate", "Date", "date"], "") || ""),
    total: Number(pickField(rawOrder, ["total", "Total", "amount"], 0)) || 0,
    items: String(pickField(rawOrder, ["items", "Items"], "") || ""),
    paidAt: String(
      pickField(rawOrder, ["paidAt", "timestamp", "paymentTime", "Timestamp"], "") || ""
    ),
    sheetStatus: normalizeStatus(
      pickField(rawOrder, ["status", "Status", "orderStatus"], "")
    ),
  };
};

const parseTrackPayload = (payload, requestedOrderId) => {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.orders)
        ? payload.orders
        : payload?.order
          ? [payload.order]
          : payload
            ? [payload]
            : [];

  const normalized = candidates.map(normalizeTrackedOrder).filter(Boolean);
  if (!normalized.length) {
    return null;
  }

  if (!requestedOrderId) {
    return normalized[0];
  }

  return (
    normalized.find((entry) => Number(entry.orderId) === Number(requestedOrderId)) || null
  );
};

export async function fetchOrderStatusFromSheet({ orderDateKey, orderId }) {
  if (!hasConfiguredValue(ORDERS_API_URL)) {
    throw new Error("Tracking endpoint is not configured.");
  }
  if (!orderId) {
    throw new Error("orderId is required.");
  }

  const actions = [TRACK_ORDER_ACTION, "trackOrder", "track", "orderStatus"];

  for (const action of actions) {
    const url = new URL(ORDERS_API_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("orderId", String(orderId));
    url.searchParams.set("id", String(orderId));
    if (orderDateKey) {
      url.searchParams.set("orderDate", String(orderDateKey));
      url.searchParams.set("date", String(orderDateKey));
    }

    try {
      const payload = await fetchJson(
        url.toString(),
        {
          method: "GET",
          headers: { Accept: "application/json" },
        },
        6000
      );
      const parsed = parseTrackPayload(payload, orderId);
      if (parsed) {
        return parsed;
      }
    } catch {
      // Try the next action variant.
    }
  }

  throw new Error("Unable to fetch order status right now.");
}
