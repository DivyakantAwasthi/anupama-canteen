const MONITOR_ENDPOINT = process.env.REACT_APP_ORDERS_MONITOR_ENDPOINT || "/api/orders-monitor";
const POLL_INTERVAL_MS = Number(process.env.REACT_APP_KITCHEN_POLL_MS || 7000);

export const ORDER_STATUS_OPTIONS = ["pending", "preparing", "ready", "delivered"];

export const ORDER_STATUS_LABELS = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  delivered: "Delivered",
};

export const ORDER_STATUS_COLORS = {
  pending: "orange",
  preparing: "blue",
  ready: "green",
  delivered: "gray",
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

const parseTimeValue = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const normalizeMonitorOrder = (order) => ({
  orderId: String(order?.orderId || "").trim(),
  orderKey: String(order?.orderKey || `${order?.orderId || ""}:${order?.timestamp || ""}`).trim(),
  customerName: String(order?.customerName || "Guest").trim() || "Guest",
  items: String(order?.items || "").trim(),
  total: Number(order?.total || 0),
  timestamp: String(order?.timestamp || ""),
  status: normalizeStatus(order?.status),
});

export const sortNewestFirst = (orders) =>
  orders.slice().sort((left, right) => {
    const rightTime = parseTimeValue(right.timestamp);
    const leftTime = parseTimeValue(left.timestamp);

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return Number(right.orderId) - Number(left.orderId);
  });

const readJson = async (response) => {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok || payload?.ok === false || payload?.error) {
    throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
  }

  return payload;
};

export async function fetchKitchenOrders({ password, signal } = {}) {
  const response = await fetch(MONITOR_ENDPOINT, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(password ? { "x-monitor-password": password } : {}),
    },
    signal,
  });

  const payload = await readJson(response);
  const orders = Array.isArray(payload.orders) ? payload.orders : [];
  return sortNewestFirst(orders.map(normalizeMonitorOrder).filter((order) => order.orderId));
}

export async function updateKitchenOrderStatus({ orderId, status, timestamp, password }) {
  const response = await fetch(MONITOR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(password ? { "x-monitor-password": password } : {}),
    },
    body: JSON.stringify({
      orderId,
      status,
      timestamp,
      orderDate: String(timestamp || "").slice(0, 10),
    }),
  });

  const payload = await readJson(response);
  return {
    orderId: String(payload.orderId || orderId),
    status: normalizeStatus(payload.status || status),
  };
}

export const getKitchenPollInterval = () => {
  if (!Number.isFinite(POLL_INTERVAL_MS)) {
    return 7000;
  }

  return Math.min(10000, Math.max(5000, POLL_INTERVAL_MS));
};
