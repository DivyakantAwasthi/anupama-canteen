const ORDER_POST_ACTION = process.env.ORDER_POST_ACTION || "appendOrder";
const ORDERS_API_URL = String(
  process.env.ORDERS_API_URL ||
    process.env.REACT_APP_ORDERS_API_URL ||
    "https://script.google.com/macros/s/AKfycbweIgYCyssQwOIBJ8UlldadgVw_79YOgrvHeXzyZcPdf5ffA1uW3p4sDRhNn3AGwnQXlg/exec"
).trim();

const parseBody = (body) => {
  if (!body) {
    return {};
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return typeof body === "object" ? body : {};
};

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const extractOrderId = (source) => {
  if (!source || typeof source !== "object") {
    return null;
  }

  const candidates = [
    source.orderId,
    source.id,
    source.order_id,
    source.orderNumber,
    source.order_number,
    source.sheetOrderId,
  ];

  for (const value of candidates) {
    const parsed = toPositiveInt(value);
    if (parsed) {
      return parsed;
    }
  }

  return extractOrderId(source.order) || extractOrderId(source.data) || extractOrderId(source.result);
};

const evaluateResponse = async (response) => {
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
    return { ok: true, payload: parsed };
  } catch {
    return { ok: !/error|failed|invalid|missing/i.test(trimmed), detail: trimmed };
  }
};

const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const withRetry = async (task, attempts = 2) => {
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

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!ORDERS_API_URL) {
    return res.status(500).json({ error: "orders_api_not_configured" });
  }

  const body = parseBody(req.body);
  const {
    orderId,
    orderDateKey,
    orderDate,
    customerName,
    customerEmail,
    customerPhone,
    items,
    total,
    timestamp,
    status,
  } = body;

  if (!orderId || !customerName || !customerPhone || !items || typeof total === "undefined") {
    return res.status(400).json({ error: "missing_required_fields" });
  }

  const resolvedDate =
    orderDateKey || orderDate || String(timestamp || new Date().toISOString()).slice(0, 10);
  const resolvedTimestamp = timestamp || new Date().toISOString();
  const payload = {
    action: ORDER_POST_ACTION,
    orderId: String(orderId),
    orderDate: resolvedDate,
    customerName,
    customerEmail: customerEmail || "",
    customerPhone,
    items,
    total: Number(total).toFixed(2),
    timestamp: resolvedTimestamp,
    status: status || "payment_verified",
    name: customerName,
    email: customerEmail || "",
    phone: customerPhone,
  };

  const attempts = [];
  const variants = [
    {
      label: "form",
      request: () =>
        fetch(ORDERS_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams(payload).toString(),
        }),
    },
    {
      label: "json",
      request: () =>
        fetch(ORDERS_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
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

  for (const variant of variants) {
    try {
      const result = await withRetry(async () => {
        const response = await variant.request();
        return evaluateResponse(response);
      });

      if (result.ok) {
        return res.status(200).json({
          ok: true,
          orderId: extractOrderId(result.payload) || toPositiveInt(orderId) || undefined,
        });
      }

      attempts.push(`${variant.label}: ${result.detail || "failed"}`);
    } catch (error) {
      attempts.push(`${variant.label}: ${error?.message || "network_error"}`);
    }
  }

  return res.status(502).json({
    error: "forward_failed",
    detail: attempts.join(" | "),
  });
};
