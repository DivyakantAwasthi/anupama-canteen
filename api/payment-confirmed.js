// Vercel serverless function to accept payment gateway/bank confirmations
// Expects: POST JSON with orderId, customerName, customerPhone, items, total
// Header: x-webhook-secret must match process.env.WEBHOOK_SECRET

const ORDER_POST_ACTION = process.env.ORDER_POST_ACTION || "appendOrder";

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

const evaluateForwardResponse = async (response) => {
  const text = await response.text().catch(() => "");

  if (!response.ok) {
    return { ok: false, detail: `HTTP ${response.status} ${text}`.trim() };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true };
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
        return { ok: true };
      }
    }
  } catch {
    // non-JSON response
  }

  if (looksLikeFailureText(trimmed)) {
    return { ok: false, detail: trimmed };
  }

  return { ok: true };
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const secret = req.headers['x-webhook-secret'];
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-me';
  if (!secret || secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const body = req.body || {};
  const { orderId, customerName, customerEmail, customerPhone, items, total, timestamp } = body;

  if (!orderId || !customerName || !customerPhone || !items || typeof total === 'undefined') {
    return res.status(400).json({ error: 'missing_required_fields' });
  }

  const ORDERS_API_URL = String(process.env.ORDERS_API_URL || "").trim();
  if (!ORDERS_API_URL) {
    return res.status(500).json({ error: 'ORDERS_API_URL_not_configured' });
  }

  try {
    const params = new URLSearchParams();
    const orderDate =
      body.orderDateKey ||
      body.orderDate ||
      (timestamp ? String(timestamp).slice(0, 10) : new Date().toISOString().slice(0, 10));
    const status = body.status || "payment_verified";

    params.set('action', ORDER_POST_ACTION);
    params.set('orderId', String(orderId));
    params.set('orderDate', orderDate);
    params.set('customerName', customerName);
    params.set('customerEmail', customerEmail || '');
    params.set('customerPhone', customerPhone);
    params.set('items', items);
    params.set('total', Number(total).toFixed(2));
    params.set('timestamp', timestamp || new Date().toISOString());
    params.set('status', status);
    params.set('name', customerName);
    params.set('email', customerEmail || '');
    params.set('phone', customerPhone);

    const fetchResp = await fetch(ORDERS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: params.toString(),
    });

    const evaluated = await evaluateForwardResponse(fetchResp);
    if (!evaluated.ok) {
      console.error('Forward failed', evaluated.detail);
      return res.status(502).json({ error: 'forward_failed' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Webhook handler error', err);
    return res.status(500).json({ error: 'server_error' });
  }
};
