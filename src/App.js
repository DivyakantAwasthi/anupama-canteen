import { useCallback, useEffect, useMemo, useState } from "react";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import Confirmation from "./components/Confirmation";
import { appendOrderToSheet, fetchActiveMenuItems } from "./services/sheetsService";
import "./App.css";

function App() {
  const [menuItems, setMenuItems] = useState([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
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
  const MENU_REFRESH_INTERVAL_MS = 30000;

  const totalPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price, 0),
    [cartItems]
  );

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
          error?.message ||
            "Unable to load menu right now. Please try again."
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

  const checkout = async (event) => {
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

    // create a pending order and show QR for payment
    setIsSavingOrder(false);
    setCheckoutError("");

    const orderId = Date.now();
    const items = cartItems.map((item) => item.name).join(", ");

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
      saving: false,
      error: null,
    });

    // clear cart and close modal while awaiting payment
    setCartItems([]);
    setIsCheckoutModalOpen(false);
  };

  const confirmPayment = async () => {
    if (!orderDetails) return;

    // mark saving on the order details
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

      setOrderDetails((prev) => ({ ...prev, paid: true, saving: false }));
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
    setOrderDetails(null);
    setCheckoutError("");
  };

  if (orderDetails) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="brand-row">
            <img src="/logo.png" alt="Anupama Canteen logo" className="brand-logo" />
            <h1>Anupama Canteen</h1>
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
            <p>Quick snack ordering with instant checkout</p>
          </div>
        </div>
      </header>
      <main className="main-layout">
        <Menu
          snacks={menuItems}
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

      {isCheckoutModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Customer Details</h2>
            <p className="muted-text">
              Enter your details to place the order.
            </p>
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
