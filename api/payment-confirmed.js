// Vercel serverless function to accept payment gateway/bank confirmations
// Expects: POST JSON with orderId, customerName, customerPhone, items, total
// Header: x-webhook-secret must match process.env.WEBHOOK_SECRET

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

  const ORDERS_API_URL = process.env.ORDERS_API_URL;
  if (!ORDERS_API_URL) {
    return res.status(500).json({ error: 'ORDERS_API_URL_not_configured' });
  }

  try {
    const params = new URLSearchParams();
    params.set('orderId', String(orderId));
    params.set('customerName', customerName);
    params.set('customerEmail', customerEmail || '');
    params.set('customerPhone', customerPhone);
    params.set('items', items);
    params.set('total', Number(total).toFixed(2));
    params.set('timestamp', timestamp || new Date().toISOString());

    const fetchResp = await fetch(ORDERS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: params.toString(),
    });

    if (!fetchResp.ok) {
      const text = await fetchResp.text().catch(() => '');
      console.error('Forward failed', fetchResp.status, text);
      return res.status(502).json({ error: 'forward_failed' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Webhook handler error', err);
    return res.status(500).json({ error: 'server_error' });
  }
};
