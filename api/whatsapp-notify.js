const STATUS_MESSAGE = {
  order_placed:
    "Your order has been placed successfully.",
  preparing:
    "Your order is now being prepared.",
  ready_for_pickup:
    "Your order is ready for pickup. Please collect it at the counter.",
  delivered:
    "Your order has been delivered successfully. Thank you for ordering with us.",
};

const sanitizePhone = (phoneRaw, defaultCountryCode) => {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length === 10) {
    return `${defaultCountryCode}${digits}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return digits;
  }

  return "";
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const body = req.body || {};
  const {
    customerPhone,
    customerName,
    orderId,
    orderDateKey,
    total,
    status,
  } = body;

  if (!customerPhone || !orderId || !status) {
    return res.status(400).json({ error: "missing_required_fields" });
  }

  const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
  const DEFAULT_COUNTRY_CODE = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "91";

  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return res.status(500).json({ error: "whatsapp_config_missing" });
  }

  const to = sanitizePhone(customerPhone, DEFAULT_COUNTRY_CODE);
  if (!to) {
    return res.status(400).json({ error: "invalid_phone_number" });
  }

  const messageHeader = STATUS_MESSAGE[status] || "Your order status has been updated.";
  const messageText =
    `${messageHeader}\n` +
    `Order ID: ${orderId}\n` +
    `${orderDateKey ? `Date: ${orderDateKey}\n` : ""}` +
    `${total ? `Total: Rs. ${Number(total).toFixed(2)}\n` : ""}` +
    `${customerName ? `Name: ${customerName}` : ""}`.trim();

  const endpoint = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: messageText },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return res
        .status(502)
        .json({ error: "whatsapp_send_failed", detail: errorBody });
    }

    const data = await response.json().catch(() => ({ ok: true }));
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({
      error: "whatsapp_server_error",
      detail: error?.message || "unknown_error",
    });
  }
};
