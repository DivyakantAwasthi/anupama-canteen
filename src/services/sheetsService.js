const ORDERS_API_URL = process.env.REACT_APP_ORDERS_API_URL;
const MENU_API_URL = process.env.REACT_APP_MENU_API_URL || ORDERS_API_URL;
const NOTIFY_API_URL = process.env.REACT_APP_NOTIFY_API_URL || ORDERS_API_URL;
const ADMIN_EMAIL = process.env.REACT_APP_ADMIN_EMAIL || "";
const ADMIN_PHONE = process.env.REACT_APP_ADMIN_PHONE || "";

const DEFAULT_MENU_IMAGE = "/menu-placeholder.svg";
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
  const active = toBoolean(pickField(rawRow, ["active", "Active"], true));

  if (!name || Number.isNaN(price)) {
    return null;
  }

  return {
    id,
    name,
    price,
    image: normalizeImageUrl(image, name),
    active,
  };
}

async function postFormNoCors(url, payload) {
  if (!hasConfiguredValue(url)) {
    throw new Error("Set API URL in .env");
  }

  const form = new URLSearchParams(payload);

  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: form.toString(),
  });

  return { ok: true };
}

export async function fetchActiveMenuItems() {
  if (!hasConfiguredValue(MENU_API_URL)) {
    throw new Error("Set REACT_APP_MENU_API_URL or REACT_APP_ORDERS_API_URL in .env");
  }

  const menuUrl = new URL(MENU_API_URL);
  menuUrl.searchParams.set("action", "menu");

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

export async function appendOrderToSheet({
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  items,
  total,
  timestamp,
}) {
  if (!hasConfiguredValue(ORDERS_API_URL)) {
    throw new Error("Set REACT_APP_ORDERS_API_URL in .env");
  }

  return postFormNoCors(ORDERS_API_URL, {
    orderId: String(orderId),
    customerName,
    customerEmail,
    customerPhone,
    items,
    total: total.toFixed(2),
    timestamp,
  });
}

export async function sendOrderNotification({
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  items,
  total,
  timestamp,
}) {
  if (!hasConfiguredValue(NOTIFY_API_URL)) {
    throw new Error("Set REACT_APP_NOTIFY_API_URL or REACT_APP_ORDERS_API_URL in .env");
  }

  return postFormNoCors(NOTIFY_API_URL, {
    action: "notify",
    orderId: String(orderId),
    customerName,
    customerEmail,
    customerPhone,
    adminEmail: ADMIN_EMAIL,
    adminPhone: ADMIN_PHONE,
    items,
    total: total.toFixed(2),
    timestamp,
  });
}
