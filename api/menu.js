module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const ORDERS_API_URL = String(process.env.ORDERS_API_URL || "").trim();
  if (!ORDERS_API_URL) {
    return res.status(500).json({ error: "ORDERS_API_URL_not_configured" });
  }

  try {
    const sourceUrl = new URL(ORDERS_API_URL);
    sourceUrl.searchParams.set("action", "menu");

    const upstream = await fetch(sourceUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const text = await upstream.text().catch(() => "");
    if (!upstream.ok) {
      return res.status(502).json({
        error: "menu_upstream_failed",
        detail: `HTTP ${upstream.status}`,
      });
    }

    let payload;
    try {
      payload = text ? JSON.parse(text) : [];
    } catch {
      return res.status(502).json({
        error: "menu_upstream_invalid_json",
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      error: "server_error",
      detail: error?.message || "unknown_error",
    });
  }
};
