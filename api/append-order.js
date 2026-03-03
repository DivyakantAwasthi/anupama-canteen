const ORDER_POST_ACTION = process.env.ORDER_POST_ACTION || "appendOrder";

const parseRequestBody = (body) => {
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

  if (typeof body === "object") {
    return body;
  }

  return {};
};

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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const ORDERS_API_URL = String(process.env.ORDERS_API_URL || "").trim();
  if (!ORDERS_API_URL) {
    return res.status(500).json({ error: "ORDERS_API_URL_not_configured" });
  }

  const body = parseRequestBody(req.body);
  const {
    orderId,
    customerName,
    customerEmail,
    customerPhone,
    items,
    total,
    timestamp,
    orderDate,
    orderDateKey,
    status,
  } = body;

  if (!orderId || !customerName || !customerPhone || !items || typeof total === "undefined") {
    return res.status(400).json({ error: "missing_required_fields" });
  }

  try {
    const requestAttempts = [];
    const resolvedOrderDate =
      orderDateKey ||
      orderDate ||
      (timestamp ? String(timestamp).slice(0, 10) : new Date().toISOString().slice(0, 10));
    const actionPayload = {
      action: ORDER_POST_ACTION,
      orderId: String(orderId),
      orderDate: resolvedOrderDate,
      customerName,
      customerEmail: customerEmail || "",
      customerPhone,
      items,
      total: Number(total).toFixed(2),
      timestamp: timestamp || new Date().toISOString(),
      status: status || "payment_verified",
      name: customerName,
      email: customerEmail || "",
      phone: customerPhone,
    };
    const legacyPayload = {
      orderId: String(orderId),
      customerName,
      customerEmail: customerEmail || "",
      customerPhone,
      items,
      total: Number(total).toFixed(2),
      timestamp: actionPayload.timestamp,
    };

    const tryForward = async (label, requestFn) => {
      try {
        const forwardResponse = await requestFn();
        const evaluated = await evaluateForwardResponse(forwardResponse);
        if (evaluated.ok) {
          return true;
        }

        requestAttempts.push(`${label}: ${evaluated.detail || "forward_failed"}`);
        return false;
      } catch (error) {
        requestAttempts.push(`${label}: ${error?.message || "network_error"}`);
        return false;
      }
    };

    const actionFormParams = new URLSearchParams(actionPayload);
    const actionFormSuccess = await tryForward("POST form(action)", () =>
      fetch(ORDERS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: actionFormParams.toString(),
      })
    );

    if (!actionFormSuccess) {
      const actionJsonSuccess = await tryForward("POST json(action)", () =>
        fetch(ORDERS_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(actionPayload),
        })
      );

      if (!actionJsonSuccess) {
        const legacyFormParams = new URLSearchParams(legacyPayload);
        const legacyFormSuccess = await tryForward("POST form(legacy)", () =>
          fetch(ORDERS_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body: legacyFormParams.toString(),
          })
        );

        if (!legacyFormSuccess) {
          const actionGetUrl = new URL(ORDERS_API_URL);
          Object.entries(actionPayload).forEach(([key, value]) => {
            actionGetUrl.searchParams.set(key, value);
          });

          const actionGetSuccess = await tryForward("GET query(action)", () =>
            fetch(actionGetUrl.toString(), {
              method: "GET",
            })
          );

          if (!actionGetSuccess) {
            const legacyGetUrl = new URL(ORDERS_API_URL);
            Object.entries(legacyPayload).forEach(([key, value]) => {
              legacyGetUrl.searchParams.set(key, value);
            });

            const legacyGetSuccess = await tryForward("GET query(legacy)", () =>
              fetch(legacyGetUrl.toString(), {
                method: "GET",
              })
            );

            if (!legacyGetSuccess) {
              return res.status(502).json({
                error: "forward_failed",
                detail: requestAttempts.join(" | "),
              });
            }
          }
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Append endpoint error", error);
    return res
      .status(500)
      .json({ error: "server_error", detail: error?.message || "unknown_error" });
  }
};
