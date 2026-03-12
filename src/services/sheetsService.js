const ORDERS_API_URL = process.env.REACT_APP_ORDERS_API_URL;
const MENU_API_URL = process.env.REACT_APP_MENU_API_URL || "/api/menu";
const APPEND_ORDER_ENDPOINT =
  process.env.REACT_APP_APPEND_ORDER_ENDPOINT || "/append-order";
const DEFAULT_MENU_IMAGE = "/menu-placeholder.svg";
const ORDER_POST_ACTION = process.env.REACT_APP_ORDER_POST_ACTION || "appendOrder";
const TRACK_ORDER_ACTION = process.env.REACT_APP_TRACK_ORDER_ACTION || "trackOrder";
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
  "veg noodles half":
    "https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=800&q=80",
  "veg noodles full":
    "https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=800&q=80",
};

const hasConfiguredValue = (value) =>
  typeof value === "string" &&
  value.trim() !== "" &&
  !value.startsWith("YOUR_") &&
  !value.includes("<");

const toBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "y", "active"].includes(normalized);
  }

  return false;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const pickField = (source, keys, fallback = "") => {
  for (const key of keys) {
    if (key in source) {
      return source[key];
    }
  }
  return fallback;
};

const normalizeNameKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const stableImageForName = (name) =>
  STABLE_MENU_IMAGE_BY_NAME[normalizeNameKey(name)] || DEFAULT_MENU_IMAGE;

const normalizeImageUrl = (value, name) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return stableImageForName(name);
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return stableImageForName(name);
    }

    if (parsed.hostname === "source.unsplash.com") {
      return stableImageForName(name);
    }

    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
      return parsed.toString();
    }

    return parsed.toString();
  } catch {
    return stableImageForName(name);
  }
};

function normalizeMenuRow(rawRow, index) {
  if (!rawRow || typeof rawRow !== "object") {
    return null;
  }

  const id = String(pickField(rawRow, ["id", "ID", "Id"], index + 1));
  const name = String(pickField(rawRow, ["name", "Name"])).trim();
  const price = toNumber(pickField(rawRow, ["price", "Price"], ""));
  const image = String(
    pickField(rawRow, ["image", "Image", "imageUrl", "imageURL"], "")
  ).trim();
  const category = String(
    pickField(rawRow, ["category", "Category", "type", "Type"], "")
  ).trim();
  const active = toBoolean(pickField(rawRow, ["active", "Active"], true));

  if (!name || Number.isNaN(price)) {
    return null;
  }

  return {
    id,
    name,
    price,
    image: normalizeImageUrl(image, name),
    category,
    active,
  };
}

export async function fetchActiveMenuItems() {
  if (!hasConfiguredValue(MENU_API_URL)) {
    throw new Error("Set REACT_APP_MENU_API_URL or REACT_APP_ORDERS_API_URL in .env");
  }

  const menuUrl = new URL(
    MENU_API_URL,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );
  const isVercelProxy = menuUrl.pathname === "/api/menu";
  if (!isVercelProxy) {
    menuUrl.searchParams.set("action", "menu");
  }

  const response = await fetch(menuUrl.toString(), {
    method: "GET",
    mode: "cors",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch menu items from API");
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
      ? payload
      : [];

  return rows
    .map((row, index) => normalizeMenuRow(row, index))
    .filter((row) => row && row.active);
}

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
  orderDate: orderDateKey || "",
  customerName,
  customerEmail,
  customerPhone,
  items,
  total: Number(total).toFixed(2),
  timestamp,
  status: status || "payment_verified",
  name: customerName,
  email: customerEmail,
  phone: customerPhone,
});

const buildLegacyOrderPayload = ({
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  items,
  total,
  timestamp,
}) => ({
  orderId: String(orderId),
  customerName,
  customerEmail,
  customerPhone,
  items,
  total: Number(total).toFixed(2),
  timestamp,
});

const normalizeStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const map = {
    pending_payment: "pending_payment",
    awaiting_payment: "pending_payment",
    payment_pending: "pending_payment",
    payment_verified: "payment_verified",
    paid: "payment_verified",
    preparing: "preparing",
    in_kitchen: "preparing",
    cooking: "preparing",
    ready: "ready_for_pickup",
    ready_for_pickup: "ready_for_pickup",
    delivered: "delivered",
    delivered_successfully: "delivered",
    complete: "delivered",
    completed: "delivered",
    cancelled: "cancelled",
    canceled: "cancelled",
  };

  return map[normalized] || "";
};

const readField = (source, keys, fallback = "") => {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return fallback;
};

const normalizeTrackedOrder = (rawOrder) => {
  if (!rawOrder || typeof rawOrder !== "object") {
    return null;
  }

  const orderIdValue = readField(rawOrder, ["orderId", "id", "Order ID", "OrderId"], "");
  const orderId = Number(orderIdValue);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return null;
  }

  const statusRaw = readField(rawOrder, ["status", "Status", "orderStatus"], "");
  const status = normalizeStatus(statusRaw);

  return {
    orderId,
    orderDateKey: String(readField(rawOrder, ["orderDate", "date", "Date"], "") || ""),
    total: Number(readField(rawOrder, ["total", "Total", "amount"], 0)) || 0,
    items: String(readField(rawOrder, ["items", "Items"], "") || ""),
    paidAt: String(readField(rawOrder, ["paidAt", "paymentTime", "timestamp"], "") || ""),
    sheetStatus: status || "",
  };
};

const looksLikeFailureText = (text) => {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return [
    "error",
    "failed",
    "missing",
    "invalid",
    "unauthorized",
    "forbidden",
    "exception",
    "not configured",
  ].some((token) => normalized.includes(token));
};

const evaluateHttpResult = async (response) => {
  const bodyText = await response.text().catch(() => "");

  if (!response.ok) {
    return {
      ok: false,
      detail: `HTTP ${response.status} ${bodyText}`.trim(),
    };
  }

  const trimmed = bodyText.trim();
  if (!trimmed) {
    return { ok: true, detail: "HTTP 200 (empty body)" };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      if (parsed.ok === false || parsed.success === false || parsed.error) {
        return {
          ok: false,
          detail: parsed.error || parsed.message || trimmed,
        };
      }

      if (parsed.ok === true || parsed.success === true) {
        return { ok: true, detail: "accepted" };
      }
    }
  } catch {
    // non-JSON response body
  }

  if (looksLikeFailureText(trimmed)) {
    return { ok: false, detail: trimmed };
  }

  return { ok: true, detail: trimmed };
};

export async function appendOrderToSheet(orderData) {
  const payloadData = buildOrderPayload(orderData);
  const proxyPayloadData = {
    ...payloadData,
    orderDateKey: orderData?.orderDateKey || "",
  };
  const legacyPayloadData = buildLegacyOrderPayload(orderData);
  const formPayload = new URLSearchParams(payloadData);
  const legacyFormPayload = new URLSearchParams(legacyPayloadData);
  const requestAttempts = [];

  const tryRequest = async (label, requestFn) => {
    try {
      const response = await requestFn();
      const evaluated = await evaluateHttpResult(response);
      if (evaluated.ok) {
        return true;
      }

      requestAttempts.push(`${label}: ${evaluated.detail}`.trim());
      return false;
    } catch (error) {
      requestAttempts.push(`${label}: ${error?.message || "Network/CORS error"}`);
      return false;
    }
  };

  const proxySuccess = await tryRequest("POST append-order proxy", () =>
    fetch(APPEND_ORDER_ENDPOINT, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(proxyPayloadData),
    })
  );

  if (proxySuccess) {
    return { ok: true };
  }

  if (!hasConfiguredValue(ORDERS_API_URL)) {
    throw new Error(
      `Unable to write order: append-order proxy failed and REACT_APP_ORDERS_API_URL is not configured. Attempts: ${requestAttempts.join(
        " | "
      )}`
    );
  }

  const formSuccess = await tryRequest("POST form(action)", () =>
    fetch(ORDERS_API_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: formPayload.toString(),
    })
  );

  if (formSuccess) {
    return { ok: true };
  }

  const jsonSuccess = await tryRequest("POST json(action)", () =>
    fetch(ORDERS_API_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payloadData),
    })
  );

  if (jsonSuccess) {
    return { ok: true };
  }

  const legacyFormSuccess = await tryRequest("POST form(legacy)", () =>
    fetch(ORDERS_API_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: legacyFormPayload.toString(),
    })
  );

  if (legacyFormSuccess) {
    return { ok: true };
  }

  const url = new URL(ORDERS_API_URL);
  Object.entries(payloadData).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const getSuccess = await tryRequest("GET query(action)", () =>
    fetch(url.toString(), {
      method: "GET",
      mode: "cors",
    })
  );

  if (getSuccess) {
    return { ok: true };
  }

  throw new Error(`Unable to write order to Sheets: ${requestAttempts.join(" | ")}`);
}

const parseTrackPayload = (payload, requestedOrderId) => {
  const candidates = [];

  if (Array.isArray(payload)) {
    candidates.push(...payload);
  } else if (payload && typeof payload === "object") {
    if (Array.isArray(payload.items)) {
      candidates.push(...payload.items);
    }
    if (Array.isArray(payload.orders)) {
      candidates.push(...payload.orders);
    }
    if (payload.order && typeof payload.order === "object") {
      candidates.push(payload.order);
    }
    candidates.push(payload);
  }

  const normalized = candidates
    .map((candidate) => normalizeTrackedOrder(candidate))
    .filter(Boolean);

  if (!normalized.length) {
    return null;
  }

  if (requestedOrderId !== undefined && requestedOrderId !== null && requestedOrderId !== "") {
    return (
      normalized.find((item) => Number(item.orderId) === Number(requestedOrderId)) || null
    );
  }

  return normalized[0];
};

export async function fetchOrderStatusFromSheet({ orderDateKey, orderId }) {
  if (!hasConfiguredValue(ORDERS_API_URL)) {
    throw new Error("Set REACT_APP_ORDERS_API_URL in .env");
  }

  if (!orderId) {
    throw new Error("orderId is required");
  }

  const actions = [TRACK_ORDER_ACTION, "track", "orderStatus"];
  let lastError = "";

  for (const action of actions) {
    try {
      const url = new URL(ORDERS_API_URL);
      url.searchParams.set("action", action);
      url.searchParams.set("orderId", String(orderId));
      url.searchParams.set("id", String(orderId));
      if (orderDateKey) {
        url.searchParams.set("orderDate", orderDateKey);
        url.searchParams.set("date", orderDateKey);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        mode: "cors",
      });

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }

      const text = await response.text();
      if (!text) {
        continue;
      }

      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        continue;
      }

      const parsed = parseTrackPayload(payload, orderId);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      lastError = error?.message || "Network/CORS error";
    }
  }

  throw new Error(lastError || "Unable to fetch order status");
}
