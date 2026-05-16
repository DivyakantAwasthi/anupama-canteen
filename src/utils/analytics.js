const ANALYTICS_STORAGE_KEY = "anupama:analytics:v1";

const readAnalytics = () => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(ANALYTICS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeAnalytics = (record) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Analytics must never affect ordering.
  }
};

export const trackEvent = (eventName, payload = {}) => {
  if (typeof window === "undefined") {
    return;
  }

  const record = readAnalytics();
  const events = Array.isArray(record.events) ? record.events.slice(-99) : [];
  const nextEvent = {
    event: eventName,
    payload,
    at: new Date().toISOString(),
  };

  const itemViews = { ...(record.itemViews || {}) };
  if (eventName === "menu_item_viewed" && payload.itemId) {
    itemViews[payload.itemId] = Number(itemViews[payload.itemId] || 0) + 1;
  }

  const ctaClicks = { ...(record.ctaClicks || {}) };
  if (eventName.endsWith("_click")) {
    const key = payload.label || eventName;
    ctaClicks[key] = Number(ctaClicks[key] || 0) + 1;
  }

  writeAnalytics({
    ...record,
    events: [...events, nextEvent],
    itemViews,
    ctaClicks,
  });

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(nextEvent);
};
