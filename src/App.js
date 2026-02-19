import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const DEFAULT_CATEGORY = "Popular";
const ALL_CATEGORIES = "All";

const inferCategoryFromName = (name) => {
  const value = String(name || "").toLowerCase();

  if (/(tea|coffee|cold coffee|drink|juice|shake|lassi|coke|campa)/.test(value)) {
    return "Beverages";
  }

  if (/(sandwich|vada pav|samosa|roll|burger|cutlet|toast)/.test(value)) {
    return "Quick Bites";
  }

  if (/(idli|dosa|uttapam|poha|upma|paratha)/.test(value)) {
    return "South Indian";
  }

  if (/(noodle|manchurian|chowmein|rice|fried rice)/.test(value)) {
    return "Meals";
  }

  return DEFAULT_CATEGORY;
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

  return inferCategoryFromName(name);
};

const BrandStrip = () => {
  const brands = [amul, campa, coke, heinz, hellman, maggi, mdh, nestle, veeba];

  return (
    <div className="brand-strip">
      {brands.map((logo, index) => (
        <img
          key={index}
          src={logo}
          className="brand-strip-logo"
          alt="Partner brand logo"
        />
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
  const orderStatusTimerRef = useRef(null);

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

  const clearOrderStatusTimer = useCallback(() => {
    if (orderStatusTimerRef.current) {
      clearTimeout(orderStatusTimerRef.current);
      orderStatusTimerRef.current = null;
    }
  }, []);

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
    clearOrderStatusTimer();

    if (!orderDetails?.paid) {
      return;
    }

    if (orderDetails.status === "payment_verified") {
      orderStatusTimerRef.current = setTimeout(() => {
        setOrderDetails((prev) =>
          prev
            ? {
                ...prev,
                status: "preparing",
                statusUpdatedAt: new Date().toISOString(),
              }
            : prev
        );
      }, 20000);
    }

    if (orderDetails.status === "preparing") {
      orderStatusTimerRef.current = setTimeout(() => {
        setOrderDetails((prev) =>
          prev
            ? {
                ...prev,
                status: "ready_for_pickup",
                statusUpdatedAt: new Date().toISOString(),
              }
            : prev
        );
      }, 30000);
    }

    return clearOrderStatusTimer;
  }, [orderDetails?.paid, orderDetails?.status, clearOrderStatusTimer]);

  useEffect(() => clearOrderStatusTimer, [clearOrderStatusTimer]);

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
    clearOrderStatusTimer();

    const orderId = Date.now();
    const items = cartItems.map((item) => `${item.name} x${item.quantity || 1}`).join(", ");

    setOrderDetails({
      orderId,
      total: totalPrice,
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim(),
        phone: customer.phone.trim(),
      },
      items,
      paid: false,
      status: "pending_payment",
      statusUpdatedAt: new Date().toISOString(),
      saving: false,
      error: null,
    });

    setCartItems([]);
    setIsCheckoutModalOpen(false);
  };

  const confirmPayment = async () => {
    if (!orderDetails) {
      return;
    }

    setOrderDetails((prev) => ({ ...prev, saving: true, error: null }));

    const timestamp = new Date().toISOString();

    try {
      await appendOrderToSheet({
        orderId: orderDetails.orderId,
        customerName: orderDetails.customer.name,
        customerEmail: orderDetails.customer.email,
        customerPhone: orderDetails.customer.phone,
        items: orderDetails.items,
        total: orderDetails.total,
        timestamp,
      });

      setOrderDetails((prev) => ({
        ...prev,
        paid: true,
        saving: false,
        status: "payment_verified",
        statusUpdatedAt: new Date().toISOString(),
      }));
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

  const startNewOrder = () => {
    clearOrderStatusTimer();
    setOrderDetails(null);
    setCheckoutError("");
  };

  if (orderDetails) {
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
          order={orderDetails}
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
        <div className="hero-bar" aria-label="Service highlights">
          <span className="hero-chip">Live menu updates</span>
          <span className="hero-chip">Search and category filters</span>
          <span className="hero-chip">Live order status after payment</span>
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
        <Cart
          items={cartItems}
          total={totalPrice}
          onRemove={removeFromCart}
          onCheckout={openCheckoutModal}
          isSavingOrder={isSavingOrder}
          error={checkoutError}
        />
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
