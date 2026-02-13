Webhook receiver for payment confirmations

Install & run locally:

```bash
cd server
npm install
WEBHOOK_SECRET=your-secret ORDERS_API_URL="https://script.google.com/macros/s/.../exec" npm start
```

Usage:
- Configure your payment gateway or bank webhook to POST JSON to `/payment-confirmed` with header `x-webhook-secret: your-secret`.
- Body should contain `orderId`, `customerName`, `customerPhone`, `items`, `total` and optional `customerEmail`, `timestamp`.

The server forwards the payload to the `ORDERS_API_URL` configured in environment and returns 200 on success.

Deploy:
- Deploy to any Node.js host (Vercel serverless functions, Render, Heroku). Make sure `ORDERS_API_URL` and `WEBHOOK_SECRET` are set in environment variables.
