require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ORDERS_API_URL = process.env.ORDERS_API_URL; // server-side URL to append orders (Google Apps Script / API)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "change-me";

if (!ORDERS_API_URL) {
  console.warn('Warning: ORDERS_API_URL is not set in environment. Webhook will not be able to forward orders.');
}

app.post('/payment-confirmed', async (req, res) => {
  // Simple shared-secret verification. Replace with proper signature verification for production.
  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { orderId, customerName, customerEmail, customerPhone, items, total, timestamp } = req.body || {};

  if (!orderId || !customerName || !customerPhone || !items || typeof total === 'undefined') {
    return res.status(400).json({ error: 'missing_required_fields' });
  }

  if (!ORDERS_API_URL) {
    return res.status(500).json({ error: 'ORDERS_API_URL_not_configured' });
  }

  try {
    const payload = new URLSearchParams();
    payload.set('orderId', String(orderId));
    payload.set('customerName', customerName);
    payload.set('customerEmail', customerEmail || '');
    payload.set('customerPhone', customerPhone);
    payload.set('items', items);
    payload.set('total', Number(total).toFixed(2));
    payload.set('timestamp', timestamp || new Date().toISOString());

    const resp = await fetch(ORDERS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: payload.toString(),
    });

    // Some Apps Script endpoints may not return JSON; treat non-error status as success.
    if (!resp.ok) {
      console.error('Forward to ORDERS_API_URL failed', resp.status, await resp.text());
      return res.status(502).json({ error: 'forward_failed' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Webhook processing error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
