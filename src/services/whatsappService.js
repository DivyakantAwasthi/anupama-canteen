const WHATSAPP_NOTIFY_ENDPOINT =
  process.env.REACT_APP_WHATSAPP_NOTIFY_ENDPOINT || "/api/whatsapp-notify";

export async function sendWhatsAppStatusNotification({
  customerPhone,
  customerName,
  orderId,
  orderDateKey,
  total,
  status,
}) {
  if (!customerPhone || !orderId || !status) {
    return { ok: false, skipped: true };
  }

  const response = await fetch(WHATSAPP_NOTIFY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerPhone,
      customerName,
      orderId,
      orderDateKey,
      total,
      status,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `WhatsApp notify failed (${response.status})`);
  }

  return response.json().catch(() => ({ ok: true }));
}
