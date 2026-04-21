require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ORDERS_API_URL = process.env.ORDERS_API_URL; // server-side URL to append orders (Google Apps Script / API)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "change-me";
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
        return { ok: true, payload: parsed };
      }

      return { ok: true, payload: parsed };
    }
  } catch {
    // non-JSON response
  }

  if (looksLikeFailureText(trimmed)) {
    return { ok: false, detail: trimmed };
  }

  return { ok: true };
};

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const extractOrderIdFromObject = (source) => {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const direct = [
    source.orderId,
    source.id,
    source.order_id,
    source.orderNumber,
    source.order_number,
    source.sheetOrderId,
    source.sheet_order_id,
  ];

  for (const candidate of direct) {
    const parsed = toPositiveInt(candidate);
    if (parsed) {
      return parsed;
    }
  }

  const nested = [source.order, source.data, source.result];
  for (const value of nested) {
    const parsed = extractOrderIdFromObject(value);
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

if (!ORDERS_API_URL) {
  console.warn('Warning: ORDERS_API_URL is not set in environment. Webhook will not be able to forward orders.');
}

const forwardOrderToSheets = async (sourceBody) => {
  const { orderId, customerName, customerEmail, customerPhone, items, total, timestamp } =
    sourceBody || {};

  if (!orderId || !customerName || !customerPhone || !items || typeof total === 'undefined') {
    return { ok: false, status: 400, error: 'missing_required_fields' };
  }

  if (!ORDERS_API_URL) {
    return { ok: false, status: 500, error: 'ORDERS_API_URL_not_configured' };
  }

  const requestAttempts = [];
  const orderDate =
    sourceBody.orderDateKey ||
    sourceBody.orderDate ||
    (timestamp ? String(timestamp).slice(0, 10) : new Date().toISOString().slice(0, 10));
  const status = sourceBody.status || "payment_verified";
  const actionPayload = {
    action: ORDER_POST_ACTION,
    orderId: String(orderId),
    orderDate,
    customerName,
    customerEmail: customerEmail || '',
    customerPhone,
    items,
    total: Number(total).toFixed(2),
    timestamp: timestamp || new Date().toISOString(),
    status,
    name: customerName,
    email: customerEmail || '',
    phone: customerPhone,
  };
  const legacyPayload = {
    orderId: String(orderId),
    customerName,
    customerEmail: customerEmail || '',
    customerPhone,
    items,
    total: Number(total).toFixed(2),
    timestamp: actionPayload.timestamp,
  };

  let canonicalOrderId = null;

  const tryForward = async (label, requestFn) => {
    try {
      const resp = await requestFn();
      const evaluated = await evaluateForwardResponse(resp);
      if (evaluated.ok) {
        const extracted = extractOrderIdFromObject(evaluated.payload);
        if (extracted) {
          canonicalOrderId = extracted;
        }
        return true;
      }

      requestAttempts.push(`${label}: ${evaluated.detail || "forward_failed"}`);
      return false;
    } catch (error) {
      requestAttempts.push(`${label}: ${error?.message || "network_error"}`);
      return false;
    }
  };

  const actionFormSuccess = await tryForward('POST form(action)', () =>
    fetch(ORDERS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams(actionPayload).toString(),
    })
  );

  if (!actionFormSuccess) {
    const actionJsonSuccess = await tryForward('POST json(action)', () =>
      fetch(ORDERS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(actionPayload),
      })
    );

    if (!actionJsonSuccess) {
      const legacyFormSuccess = await tryForward('POST form(legacy)', () =>
        fetch(ORDERS_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: new URLSearchParams(legacyPayload).toString(),
        })
      );

      if (!legacyFormSuccess) {
        const actionGetUrl = new URL(ORDERS_API_URL);
        Object.entries(actionPayload).forEach(([key, value]) => {
          actionGetUrl.searchParams.set(key, value);
        });

        const actionGetSuccess = await tryForward('GET query(action)', () =>
          fetch(actionGetUrl.toString(), {
            method: 'GET',
          })
        );

        if (!actionGetSuccess) {
          const legacyGetUrl = new URL(ORDERS_API_URL);
          Object.entries(legacyPayload).forEach(([key, value]) => {
            legacyGetUrl.searchParams.set(key, value);
          });

          const legacyGetSuccess = await tryForward('GET query(legacy)', () =>
            fetch(legacyGetUrl.toString(), {
              method: 'GET',
            })
          );

          if (!legacyGetSuccess) {
            console.error('Forward to ORDERS_API_URL failed', requestAttempts.join(' | '));
            return {
              ok: false,
              status: 502,
              error: 'forward_failed',
              detail: requestAttempts.join(' | '),
            };
          }
        }
      }
    }
  }

  return {
    ok: true,
    status: 200,
    orderId: canonicalOrderId || toPositiveInt(orderId) || undefined,
  };
};

app.post('/append-order', async (req, res) => {
  try {
    const result = await forwardOrderToSheets(req.body || {});
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, detail: result.detail || '' });
    }
    return res.json({ ok: true, orderId: result.orderId });
  } catch (err) {
    console.error('append-order processing error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.post('/payment-confirmed', async (req, res) => {
  // Simple shared-secret verification. Replace with proper signature verification for production.
  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const result = await forwardOrderToSheets(req.body || {});
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, detail: result.detail || '' });
    }
    return res.json({ ok: true, orderId: result.orderId });
  } catch (err) {
    console.error('Webhook processing error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
