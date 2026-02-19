import { useCallback, useEffect, useMemo, useState } from "react";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import Confirmation from "./components/Confirmation";
import { appendOrderToSheet, fetchActiveMenuItems } from "./services/sheetsService";
import "./App.css";
import amul from "./assets/brands/amul.png";
import campa from "./assets/brands/campa.png";
import coke from "./assets/brands/coke.png";
import heinz from "./assets/brands/heinz.png";
import hellman from "./assets/brands/hellman.png";
import maggi from "./assets/brands/maggi.png";
import mdh from "./assets/brands/mdh.png";
import nestle from "./assets/brands/nestle.png";
import veeba from "./assets/brands/veeba.png";

const MENU_REFRESH_INTERVAL_MS = 30000;
const STATUS_TICK_INTERVAL_MS = 1000;
const DEFAULT_CATEGORY = "Popular";
const ALL_CATEGORIES = "All";
const PREPARING_START_MS = 20000;
const READY_START_MS = 50000;
const ORDER_COUNTER_KEY_PREFIX = "anupama:orderCounter:";
const ORDERS_STORAGE_KEY_PREFIX = "anupama:orders:";

const STATUS_TEXT = {
  pending_payment: "Awaiting payment",
  payment_verified: "Payment verified",
  preparing: "Preparing order",
  ready_for_pickup: "Ready for pickup",
};

const getTodayDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getCounterKey = (dateKey) => `${ORDER_COUNTER_KEY_PREFIX}${dateKey}`;
const getOrdersKey = (dateKey) => `${ORDERS_STORAGE_KEY_PREFIX}${dateKey}`;

const readOrdersForDate = (dateKey) => {
  try {
    const raw = localStorage.getItem(getOrdersKey(dateKey));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeOrdersForDate = (dateKey, records) => {
  localStorage.setItem(getOrdersKey(dateKey), JSON.stringify(records));
};

const upsertOrderForDate = (dateKey, orderRecord) => {
  const records = readOrdersForDate(dateKey);
  const index = records.findIndex((record) => record.orderId === orderRecord.orderId);

  if (index >= 0) {
    records[index] = orderRecord;
  } else {
    records.push(orderRecord);
  }

  writeOrdersForDate(dateKey, records);
};

const getNextDailyOrderId = (dateKey) => {
  const counterKey = getCounterKey(dateKey);
  const current = Number(localStorage.getItem(counterKey) || 0);
  const next = Number.isFinite(current) ? current + 1 : 1;
  localStorage.setItem(counterKey, String(next));
  return next;
};

const deriveStatus = (orderRecord, nowMs) => {
  if (!orderRecord?.paidAt) {
    return "pending_payment";
  }

  const elapsedMs = Math.max(0, nowMs - new Date(orderRecord.paidAt).getTime());

  if (elapsedMs < PREPARING_START_MS) {
    return "payment_verified";
  }

  if (elapsedMs < READY_START_MS) {
    return "preparing";
  }

  return "ready_for_pickup";
};

const toCategoryLabel = (value, name) => {
  const raw = String(value || "").trim();
  if (raw) {
    return raw
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" ");
  }

  const lowerName = String(name || "").toLowerCase();

  if (/(tea|coffee|cold coffee|drink|juice|shake|lassi|coke|campa)/.test(lowerName)) {
    return "Beverages";
  }

  if (/(sandwich|vada pav|samosa|roll|burger|cutlet|toast)/.test(lowerName)) {
    return "Quick Bites";
  }

  if (/(idli|dosa|uttapam|poha|upma|paratha)/.test(lowerName)) {
    return "South Indian";
  }

  if (/(noodle|manchurian|chowmein|rice|fried rice)/.test(lowerName)) {
    return "Meals";
  }

  return DEFAULT_CATEGORY;
};

const BrandStrip = () => {
  const brands = [
    amul,
    campa,
    coke,
    heinz,
    hellman,
    maggi,
    mdh,
    nestle,
    veeba,
    "/brands/kissan.png",
    "/brands/knorr.png",
    "/brands/everest.png",
    "/brands/mtr.png",
    "/brands/chings.svg",
  ];

  return (
    <div className="brand-strip">
      {brands.map((logo, index) => (
        <img key={index} src={logo} className="brand-strip-logo" alt="Partner brand logo" />
      ))}
    </div>
  );
};

function App() {
  const [menuItems, setMenuItems] = useState([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const [cartItems, setCartItems] = useState([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [orderDetails, setOrderDetails] = useState(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [statusNowMs, setStatusNowMs] = useState(Date.now());
  const [trackOrderIdInput, setTrackOrderIdInput] = useState("");
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingError, setTrackingError] = useState("");

  const totalPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price, 0),
    [cartItems]
  );

  const menuItemsWithCategory = useMemo(
    () =>
      menuItems.map((item) => ({
        ...item,
        category: toCategoryLabel(item.category, item.name),
      })),
    [menuItems]
  );

  const categories = useMemo(() => {
    const values = menuItemsWithCategory.map((item) => item.category);
    return [ALL_CATEGORIES, ...Array.from(new Set(values))];
  }, [menuItemsWithCategory]);

  const filteredMenuItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return menuItemsWithCategory.filter((item) => {
      const categoryMatch =
        activeCategory === ALL_CATEGORIES || item.category === activeCategory;
      const searchMatch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch);

      return categoryMatch && searchMatch;
    });
  }, [menuItemsWithCategory, activeCategory, searchQuery]);

  const currentOrder = useMemo(() => {
    if (!orderDetails) {
      return null;
    }

    return {
      ...orderDetails,
      status: deriveStatus(orderDetails, statusNowMs),
    };
  }, [orderDetails, statusNowMs]);

  const liveTrackedOrder = useMemo(() => {
    if (!trackedOrder) {
      return null;
    }

    return {
      ...trackedOrder,
      status: deriveStatus(trackedOrder, statusNowMs),
    };
  }, [trackedOrder, statusNowMs]);

  const loadMenu = useCallback(async (options = {}) => {
    const { silent = false } = options;

    if (!silent) {
      setIsMenuLoading(true);
      setMenuError("");
    }

    try {
      const items = await fetchActiveMenuItems();
      setMenuItems(items);
    } catch (error) {
      if (!silent) {
        setMenuError(
          error?.message || "Unable to load menu right now. Please try again."
        );
      }
    } finally {
      if (!silent) {
        setIsMenuLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadMenu();

    const intervalId = setInterval(() => {
      loadMenu({ silent: true });
    }, MENU_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [loadMenu]);

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(ALL_CATEGORIES);
    }
  }, [categories, activeCategory]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStatusNowMs(Date.now());
    }, STATUS_TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  const addToCart = (item) => {
    setCartItems((prev) => [...prev, item]);
  };

  const removeFromCart = (indexToRemove) => {
    setCartItems((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const openCheckoutModal = () => {
    if (!cartItems.length || isSavingOrder) {
      return;
    }

    setCheckoutError("");
    setIsCheckoutModalOpen(true);
  };

  const closeCheckoutModal = () => {
    if (isSavingOrder) {
      return;
    }

    setIsCheckoutModalOpen(false);
  };

  const onCustomerFieldChange = (event) => {
    const { name, value } = event.target;
    setCustomer((prev) => ({ ...prev, [name]: value }));
  };

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isValidPhone = (value) => /^[0-9]{10}$/.test(value);

  const checkout = (event) => {
    event.preventDefault();

    if (!cartItems.length || isSavingOrder) {
      return;
    }

    if (!customer.name.trim()) {
      setCheckoutError("Please enter your name.");
      return;
    }

    const emailTrim = customer.email.trim();
    if (emailTrim && !isValidEmail(emailTrim)) {
      setCheckoutError("Please enter a valid email address.");
      return;
    }

    if (!isValidPhone(customer.phone.trim())) {
      setCheckoutError("Please enter a 10-digit phone number.");
      return;
    }

    setIsSavingOrder(false);
    setCheckoutError("");

    const todayKey = getTodayDateKey();
    const orderId = getNextDailyOrderId(todayKey);
    const createdAt = new Date().toISOString();
    const items = cartItems.map((item) => `${item.name} x${item.quantity || 1}`).join(", ");

    const newOrder = {
      orderId,
      orderDateKey: todayKey,
      createdAt,
      paidAt: null,
      total: totalPrice,
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim(),
        phone: customer.phone.trim(),
      },
      items,
      saving: false,
      error: null,
    };

    upsertOrderForDate(todayKey, newOrder);
    setOrderDetails(newOrder);
    setCartItems([]);
    setIsCheckoutModalOpen(false);
  };

  const confirmPayment = async () => {
    if (!orderDetails) {
      return;
    }

    setOrderDetails((prev) => ({ ...prev, saving: true, error: null }));

    const nowIso = new Date().toISOString();
    const updatedOrder = {
      ...orderDetails,
      paidAt: nowIso,
      saving: false,
      error: null,
    };

    try {
      await appendOrderToSheet({
        orderId: updatedOrder.orderId,
        orderDateKey: updatedOrder.orderDateKey,
        customerName: updatedOrder.customer.name,
        customerEmail: updatedOrder.customer.email,
        customerPhone: updatedOrder.customer.phone,
        items: updatedOrder.items,
        total: updatedOrder.total,
        timestamp: nowIso,
      });

      upsertOrderForDate(updatedOrder.orderDateKey, updatedOrder);
      setOrderDetails(updatedOrder);
    } catch (error) {
      setOrderDetails((prev) => ({
        ...prev,
        saving: false,
        error:
          error?.message ||
          "Unable to confirm payment. Check your connection and try again.",
      }));
    }
  };

  const trackOrderById = () => {
    setTrackingError("");

    const trimmed = trackOrderIdInput.trim();
    const parsedId = Number(trimmed);

    if (!trimmed || !Number.isInteger(parsedId) || parsedId <= 0) {
      setTrackedOrder(null);
      setTrackingError("Enter a valid numeric order ID.");
      return;
    }

    const todayKey = getTodayDateKey();
    const todayOrders = readOrdersForDate(todayKey);
    const order = todayOrders.find((record) => Number(record.orderId) === parsedId);

    if (!order) {
      setTrackedOrder(null);
      setTrackingError(`Order #${parsedId} not found for ${todayKey}.`);
      return;
    }

    setTrackedOrder(order);
  };

  const startNewOrder = () => {
    setOrderDetails(null);
    setCheckoutError("");
  };

  if (currentOrder) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="brand-row">
            <img src="/logo.png" alt="Anupama Canteen logo" className="brand-logo" />
            <div>
              <h1>Anupama Canteen</h1>
              <p>Order confirmed after payment verification</p>
            </div>
          </div>
        </header>
        <Confirmation
          order={currentOrder}
          onConfirmPayment={confirmPayment}
          onNewOrder={startNewOrder}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-row">
          <img src="/logo.png" alt="Anupama Canteen logo" className="brand-logo" />
          <div>
            <h1>Anupama Canteen</h1>
            <p>Fresh snacks. Fast ordering. Smooth pickup.</p>
          </div>
        </div>
      </header>
      <main className="main-layout">
        <Menu
          snacks={filteredMenuItems}
          totalSnackCount={menuItemsWithCategory.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onClearFilters={() => {
            setSearchQuery("");
            setActiveCategory(ALL_CATEGORIES);
          }}
          onAddToCart={addToCart}
          isLoading={isMenuLoading}
          error={menuError}
          onRetry={() => loadMenu()}
        />
        <div className="sidebar-stack">
          <Cart
            items={cartItems}
            total={totalPrice}
            onRemove={removeFromCart}
            onCheckout={openCheckoutModal}
            isSavingOrder={isSavingOrder}
            error={checkoutError}
          />
          <section className="panel track-panel">
            <div className="panel-head">
              <h2>Track Today's Order</h2>
              <span className="panel-label">{getTodayDateKey()}</span>
            </div>
            <div className="track-form">
              <input
                type="text"
                inputMode="numeric"
                value={trackOrderIdInput}
                onChange={(event) => setTrackOrderIdInput(event.target.value)}
                placeholder="Enter order ID (e.g. 12)"
              />
              <button type="button" onClick={trackOrderById}>
                Track
              </button>
            </div>

            {trackingError ? <p className="error-text">{trackingError}</p> : null}

            {liveTrackedOrder ? (
              <div className="track-result">
                <p>
                  <strong>Order:</strong> #{liveTrackedOrder.orderId}
                </p>
                <p>
                  <strong>Status:</strong> {STATUS_TEXT[liveTrackedOrder.status]}
                </p>
                <p>
                  <strong>Total:</strong> Rs. {Number(liveTrackedOrder.total).toFixed(2)}
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <BrandStrip />

      {isCheckoutModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Customer Details</h2>
            <p className="muted-text">Enter your details to place the order.</p>
            <form onSubmit={checkout} className="checkout-form">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                value={customer.name}
                onChange={onCustomerFieldChange}
                placeholder="Enter your name"
                required
              />

              <label htmlFor="email">Email (optional)</label>
              <input
                id="email"
                name="email"
                type="email"
                value={customer.email}
                onChange={onCustomerFieldChange}
                placeholder="Enter your email"
              />

              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                value={customer.phone}
                onChange={onCustomerFieldChange}
                placeholder="10-digit mobile number"
                pattern="[0-9]{10}"
                required
              />

              {checkoutError ? <p className="error-text">{checkoutError}</p> : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeCheckoutModal}
                  disabled={isSavingOrder}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSavingOrder}>
                  {isSavingOrder ? "Saving..." : "Place Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
