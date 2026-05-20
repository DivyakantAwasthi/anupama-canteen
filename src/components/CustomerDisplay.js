import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiClock, FiMaximize2, FiRefreshCw } from "react-icons/fi";
import {
  ORDER_STATUS_LABELS,
  fetchKitchenOrders,
  getIndiaDateKey,
  getKitchenPollInterval,
  sortNewestFirst,
} from "../services/ordersMonitorService";
import "./KitchenMonitor.css";
import "./CustomerDisplay.css";

const HIGHLIGHT_MS = 9000;

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const splitItems = (items) =>
  String(items || "")
    .split(/,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);

function CustomerDisplay() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => getIndiaDateKey());
  const [highlightedIds, setHighlightedIds] = useState(() => new Set());
  const knownOrderIdsRef = useRef(new Set());
  const hasLoadedRef = useRef(false);
  const highlightTimersRef = useRef([]);
  const intervalMs = useMemo(() => getKitchenPollInterval(), []);

  const clearHighlightLater = useCallback((orderIds) => {
    const timerId = window.setTimeout(() => {
      setHighlightedIds((previous) => {
        const next = new Set(previous);
        orderIds.forEach((id) => next.delete(id));
        return next;
      });
    }, HIGHLIGHT_MS);
    highlightTimersRef.current.push(timerId);
  }, []);

  const loadOrders = useCallback(
    async ({ silent = false, signal } = {}) => {
      if (!silent) {
        setIsLoading(true);
      }

      try {
        const nextOrders = await fetchKitchenOrders({ date: selectedDate, signal });
        const nextIds = new Set(nextOrders.map((order) => order.orderId));
        const newIds = nextOrders
          .map((order) => order.orderId)
          .filter((orderId) => hasLoadedRef.current && !knownOrderIdsRef.current.has(orderId));

        // CRITICAL FIX: Detect and remove ghost orders (deleted from backend)
        const deletedIds = Array.from(knownOrderIdsRef.current).filter(
          (orderId) => !nextIds.has(orderId)
        );
        
        if (deletedIds.length > 0) {
          console.log('[CustomerDisplay] Detected deleted orders, removing:', { deletedIds });
          // Remove deleted orders from display by not including them
          setOrders((previous) =>
            previous.filter((order) => nextIds.has(order.orderId))
          );
        }

        if (newIds.length) {
          setHighlightedIds((previous) => new Set([...previous, ...newIds]));
          clearHighlightLater(newIds);
        }

        knownOrderIdsRef.current = nextIds;
        hasLoadedRef.current = true;
        setOrders(nextOrders);
        setError("");
        setLastUpdatedAt(new Date().toISOString());
      } catch (requestError) {
        if (requestError?.name !== "AbortError") {
          setError(requestError?.message || "Unable to load orders.");
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [clearHighlightLater, selectedDate]
  );

  useEffect(() => {
    const controllers = new Set();
    const runLoad = (options = {}) => {
      const controller = new AbortController();
      controllers.add(controller);
      loadOrders({ ...options, signal: controller.signal }).finally(() => {
        controllers.delete(controller);
      });
    };

    runLoad();
    const intervalId = window.setInterval(() => runLoad({ silent: true }), intervalMs);

    return () => {
      window.clearInterval(intervalId);
      controllers.forEach((controller) => controller.abort());
    };
  }, [intervalMs, loadOrders]);

  useEffect(
    () => () => {
      highlightTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    },
    []
  );

  const visibleOrders = useMemo(
    () => sortNewestFirst(orders).slice(0, 24),
    [orders]
  );

  const readyOrders = visibleOrders.filter((order) => order.status === "ready").length;
  const selectedDateLabel = useMemo(
    () =>
      new Date(`${selectedDate}T00:00:00+05:30`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }),
    [selectedDate]
  );

  const openFullscreen = () => {
    document.documentElement.requestFullscreen?.();
  };

  return (
    <main className="customer-display">
      <header className="customer-display-header">
        <div>
          <p className="kitchen-eyebrow">Customer display</p>
          <h1>Order Status</h1>
        </div>
        <div className="kitchen-header-actions">
          <div className="kitchen-stat">
            <span>Ready</span>
            <strong>{readyOrders}</strong>
          </div>
          <label className="kitchen-date-picker">
            <span>Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                knownOrderIdsRef.current = new Set();
                hasLoadedRef.current = false;
                setHighlightedIds(new Set());
                setSelectedDate(event.target.value || getIndiaDateKey());
              }}
            />
          </label>
          <button type="button" className="kitchen-icon-btn" onClick={() => loadOrders()}>
            <FiRefreshCw />
            <span>Refresh</span>
          </button>
          <button type="button" className="kitchen-icon-btn" onClick={openFullscreen}>
            <FiMaximize2 />
            <span>Full screen</span>
          </button>
        </div>
      </header>

      <section className="kitchen-toolbar">
        <div className="kitchen-pulse">
          <span />
          Showing {selectedDateLabel} orders, auto refresh every {Math.round(intervalMs / 1000)}s
        </div>
        <div className="kitchen-clock">
          <FiClock />
          Last updated {lastUpdatedAt ? formatTime(lastUpdatedAt) : "--"}
        </div>
      </section>

      {error ? <div className="kitchen-alert">{error}</div> : null}

      {isLoading ? (
        <div className="kitchen-empty">Loading order status...</div>
      ) : visibleOrders.length ? (
        <section className="customer-status-grid">
          {visibleOrders.map((order) => (
            <article
              className={`customer-status-card status-${order.status} ${
                highlightedIds.has(order.orderId) ? "is-new" : ""
              }`}
              key={order.orderId}
            >
              <div className="customer-status-top">
                <span>#{order.orderId}</span>
                <strong>{ORDER_STATUS_LABELS[order.status]}</strong>
              </div>
              <p>{order.customerName}</p>
              <ul>
                {splitItems(order.items).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <small>
                {formatTime(order.timestamp)} | {formatCurrency(order.total)}
              </small>
            </article>
          ))}
        </section>
      ) : (
        <div className="kitchen-empty">No active orders right now.</div>
      )}
    </main>
  );
}

export default CustomerDisplay;
