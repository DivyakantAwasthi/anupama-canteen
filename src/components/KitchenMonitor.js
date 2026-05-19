import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiClock, FiLock, FiRefreshCw, FiVolume2 } from "react-icons/fi";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
  fetchKitchenOrders,
  getIndiaDateKey,
  getKitchenPollInterval,
  sortNewestFirst,
  updateKitchenOrderStatus,
} from "../services/ordersMonitorService";
import "./KitchenMonitor.css";

const PASSWORD_KEY = "anupama:kitchen:password";
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

const playChime = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }

  const context = new AudioContext();
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);

  [660, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.16);
    oscillator.stop(context.currentTime + 0.55 + index * 0.16);
  });

  window.setTimeout(() => context.close(), 1100);
};

function KitchenMonitor() {
  const [password, setPassword] = useState(() => localStorage.getItem(PASSWORD_KEY) || "");
  const [passwordInput, setPasswordInput] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(() => Boolean(localStorage.getItem(PASSWORD_KEY)));
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => getIndiaDateKey());
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState(() => new Set());
  const [updatingOrderId, setUpdatingOrderId] = useState("");
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
        const nextOrders = await fetchKitchenOrders({ date: selectedDate, password, signal });
        const nextIds = new Set(nextOrders.map((order) => order.orderKey));
        const newIds = nextOrders
          .map((order) => order.orderKey)
          .filter((orderId) => hasLoadedRef.current && !knownOrderIdsRef.current.has(orderId));

        if (newIds.length) {
          setHighlightedIds((previous) => new Set([...previous, ...newIds]));
          clearHighlightLater(newIds);
          if (soundEnabled) {
            playChime();
          }
        }

        knownOrderIdsRef.current = nextIds;
        hasLoadedRef.current = true;
        setOrders(nextOrders);
        setError("");
        setLastUpdatedAt(new Date().toISOString());
      } catch (requestError) {
        if (requestError?.name !== "AbortError") {
          setError(requestError?.message || "Unable to load orders.");
          if (/unauthorized/i.test(requestError?.message || "")) {
            setIsUnlocked(false);
          }
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [clearHighlightLater, password, selectedDate, soundEnabled]
  );

  useEffect(() => {
    if (!isUnlocked) {
      setIsLoading(false);
      return undefined;
    }

    const controllers = new Set();
    const runLoad = (options = {}) => {
      const controller = new AbortController();
      controllers.add(controller);
      loadOrders({ ...options, signal: controller.signal }).finally(() => {
        controllers.delete(controller);
      });
    };

    runLoad();
    const intervalId = window.setInterval(() => {
      runLoad({ silent: true });
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
      controllers.forEach((controller) => controller.abort());
    };
  }, [intervalMs, isUnlocked, loadOrders]);

  useEffect(
    () => () => {
      highlightTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    },
    []
  );

  const visibleOrders = useMemo(() => sortNewestFirst(orders), [orders]);
  const activeOrders = useMemo(
    () => visibleOrders.filter((order) => order.status !== "delivered").length,
    [visibleOrders]
  );
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

  const unlock = (event) => {
    event.preventDefault();
    const nextPassword = passwordInput.trim();
    if (!nextPassword) {
      setError("Enter the kitchen monitor password.");
      return;
    }
    localStorage.setItem(PASSWORD_KEY, nextPassword);
    setPassword(nextPassword);
    setPasswordInput("");
    setIsUnlocked(true);
  };

  const enableSound = () => {
    setSoundEnabled(true);
    playChime();
  };

  const changeStatus = async (targetOrder, status) => {
    setUpdatingOrderId(targetOrder.orderKey);
    setOrders((previous) =>
      previous.map((order) =>
        order.orderKey === targetOrder.orderKey ? { ...order, status } : order
      )
    );

    try {
      await updateKitchenOrderStatus({
        orderId: targetOrder.orderId,
        timestamp: targetOrder.timestamp,
        status,
        password,
      });
      await loadOrders({ silent: true });
    } catch (updateError) {
      setError(updateError?.message || "Unable to update status.");
      await loadOrders({ silent: true });
    } finally {
      setUpdatingOrderId("");
    }
  };

  if (!isUnlocked) {
    return (
      <main className="kitchen-lock-screen">
        <form className="kitchen-lock-panel" onSubmit={unlock}>
          <span className="kitchen-lock-icon" aria-hidden="true">
            <FiLock />
          </span>
          <p className="kitchen-eyebrow">Kitchen monitor</p>
          <h1>Enter monitor password</h1>
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder="Password"
            autoFocus
          />
          <button type="submit">Open dashboard</button>
          {error ? <p className="kitchen-error">{error}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="kitchen-monitor">
      <header className="kitchen-header">
        <div>
          <p className="kitchen-eyebrow">Live kitchen display</p>
          <h1>Orders Monitor</h1>
        </div>

        <div className="kitchen-header-actions">
          <div className="kitchen-stat">
            <span>Active</span>
            <strong>{activeOrders}</strong>
          </div>
          <div className="kitchen-stat">
            <span>Total</span>
            <strong>{visibleOrders.length}</strong>
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
          <button
            type="button"
            className={`kitchen-icon-btn ${soundEnabled ? "is-on" : ""}`}
            onClick={enableSound}
          >
            <FiVolume2 />
            <span>{soundEnabled ? "Sound on" : "Enable sound"}</span>
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
        <button
          type="button"
          className="kitchen-link-btn"
          onClick={() => {
            localStorage.removeItem(PASSWORD_KEY);
            setPassword("");
            setIsUnlocked(false);
          }}
        >
          Lock
        </button>
      </section>

      {error ? <div className="kitchen-alert">{error}</div> : null}

      {isLoading ? (
        <div className="kitchen-empty">Loading latest orders...</div>
      ) : visibleOrders.length ? (
        <section className="orders-grid">
          {visibleOrders.map((order) => {
            const color = ORDER_STATUS_COLORS[order.status] || "orange";
            const items = splitItems(order.items);

            return (
              <article
                className={`order-card status-${color} ${
                  highlightedIds.has(order.orderKey) ? "is-new" : ""
                }`}
                key={order.orderKey}
              >
                <div className="order-card-top">
                  <div>
                    <p className="order-id">#{order.orderId}</p>
                    <h2>{order.customerName}</h2>
                  </div>
                  <span className={`status-pill status-${color}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>

                <div className="order-meta">
                  <span>{formatTime(order.timestamp)}</span>
                  <strong>{formatCurrency(order.total)}</strong>
                </div>

                <ul className="order-items">
                  {items.length ? (
                    items.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>No items listed</li>
                  )}
                </ul>

                <div className="status-controls" aria-label={`Update order ${order.orderId} status`}>
                  {ORDER_STATUS_OPTIONS.map((status) => (
                    <button
                      type="button"
                      className={order.status === status ? "is-active" : ""}
                      key={status}
                      disabled={updatingOrderId === order.orderKey}
                      onClick={() => changeStatus(order, status)}
                    >
                      {ORDER_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="kitchen-empty">No orders yet.</div>
      )}
    </main>
  );
}

export default KitchenMonitor;
