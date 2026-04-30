import {
  Suspense,
  lazy,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FiMapPin, FiPhoneCall, FiShield } from "react-icons/fi";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import {
  appendOrderToSheet,
  FALLBACK_MENU_DATA,
  fetchActiveMenuItems,
  fetchOrderStatusFromSheet,
  readCachedMenuItems,
} from "./services/sheetsService";
import { fetchReviewsByItemIds, saveReviewForItem } from "./services/reviewService";
import { sendWhatsAppStatusNotification } from "./services/whatsappService";
import { SITE_CONTENT, createWhatsAppOrderLink } from "./config/site";
import { generateDemoReviews, getRatingsFromReviews } from "./utils/reviews";
import "./App.css";

const Confirmation = lazy(() => import("./components/Confirmation"));

const MENU_REFRESH_INTERVAL_MS = 1000 * 60 * 5;
const STATUS_REFRESH_INTERVAL_MS = 1000 * 12;
const ORDER_STORAGE_PREFIX = "anupama:orders:";
const ORDER_COUNTER_PREFIX = "anupama:orderCounter:";
const WHATSAPP_SENT_PREFIX = "anupama:whatsappSent:";
const STATUS_COPY = {
  pending_payment: "Awaiting payment",
  payment_verified: "Payment verified",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const ALL_CATEGORY = "All";

const inferCategory = (item) => {
  const direct = String(item.category || "").trim();
  if (direct) {
    return direct
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" ");
  }

  const name = String(item.name || "").toLowerCase();
  if (/(tea|coffee|shake|coke|campa|drink)/.test(name)) {
    return "Beverages";
  }
  if (/(dosa|idli|poha)/.test(name)) {
    return "Breakfast";
  }
  if (/(rice|noodle|maggi)/.test(name)) {
    return "Meals";
  }
  return "Snacks";
};

const decorateMenuItem = (item, index, popularIds = new Set()) => {
  const name = String(item.name || "").trim();
  const normalizedName = name.toLowerCase();
  const isPopular =
    popularIds.has(String(item.id)) ||
    /(special|cheese|grilled|vada pav|maggi|dosa)/.test(normalizedName);

  return {
    ...item,
    name:
      name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" ") || "Menu Item",
    category: inferCategory(item),
    description:
      item.description ||
      (/(tea|coffee)/.test(normalizedName)
        ? "Freshly poured and served hot."
        : /(sandwich|vada pav|samosa)/.test(normalizedName)
          ? "A fast, comforting favourite for any hunger break."
          : "Prepared fresh and packed carefully for quick service."),
    badge: isPopular ? (index < 4 ? "Best seller" : "Popular") : "",
    isVeg: true,
  };
};

const getTodayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
};

const getOrderStorageKey = (dateKey) => `${ORDER_STORAGE_PREFIX}${dateKey}`;
const getOrderCounterKey = (dateKey) => `${ORDER_COUNTER_PREFIX}${dateKey}`;
const getWhatsAppSentKey = (orderDateKey, orderId, status) =>
  `${WHATSAPP_SENT_PREFIX}${orderDateKey}:${orderId}:${status}`;

const readOrdersForDate = (dateKey) => {
  try {
    const raw = localStorage.getItem(getOrderStorageKey(dateKey));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeOrdersForDate = (dateKey, records) => {
  localStorage.setItem(getOrderStorageKey(dateKey), JSON.stringify(records));
};

const upsertOrderForDate = (dateKey, orderRecord) => {
  const orders = readOrdersForDate(dateKey);
  const nextOrders = orders.some((entry) => Number(entry.orderId) === Number(orderRecord.orderId))
    ? orders.map((entry) =>
        Number(entry.orderId) === Number(orderRecord.orderId) ? orderRecord : entry
      )
    : [orderRecord, ...orders];

  writeOrdersForDate(dateKey, nextOrders);
};

const replaceOrderIdForDate = (dateKey, previousOrderId, nextOrder) => {
  const orders = readOrdersForDate(dateKey).filter(
    (entry) =>
      Number(entry.orderId) !== Number(previousOrderId) &&
      Number(entry.orderId) !== Number(nextOrder.orderId)
  );
  writeOrdersForDate(dateKey, [nextOrder, ...orders]);
};

const findLocalOrderById = (orderId) => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(ORDER_STORAGE_PREFIX)) {
        continue;
      }

      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      const match = Array.isArray(parsed)
        ? parsed.find((entry) => Number(entry.orderId) === Number(orderId))
        : null;

      if (match) {
        return match;
      }
    }
  } catch {
    return null;
  }

  return null;
};

const generateOrderId = (dateKey) => {
  const currentMax = readOrdersForDate(dateKey).reduce((max, entry) => {
    const parsed = Number(entry.orderId);
    return Number.isInteger(parsed) && parsed > max ? parsed : max;
  }, 0);

  const counterKey = getOrderCounterKey(dateKey);
  const stored = Number(localStorage.getItem(counterKey) || 0);
  const nextId = Math.max(currentMax, stored) + 1;
  localStorage.setItem(counterKey, String(nextId));
  return nextId;
};

const inferLocalOrderStatus = (order) => {
  if (order.sheetStatus) {
    return order.sheetStatus;
  }
  if (!order.paidAt && order.paymentMode !== "cash_counter") {
    return "pending_payment";
  }

  const elapsedMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  if (elapsedMinutes < 3) {
    return "payment_verified";
  }
  if (elapsedMinutes < 12) {
    return "preparing";
  }
  return "ready_for_pickup";
};

function App() {
  const [heroImageSrc, setHeroImageSrc] = useState(SITE_CONTENT.heroImage);
  const [menuItems, setMenuItems] = useState(() => readCachedMenuItems());
  const [isMenuLoading, setIsMenuLoading] = useState(() => readCachedMenuItems().length === 0);
  const [menuError, setMenuError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const [cartItems, setCartItems] = useState([]);
  const [checkoutError, setCheckoutError] = useState("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [todayOrders, setTodayOrders] = useState(() => readOrdersForDate(getTodayKey()));
  const [reviews, setReviews] = useState({});
  const [itemRatings, setItemRatings] = useState({});
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingItem, setReviewingItem] = useState(null);
  const [newReview, setNewReview] = useState({ name: "", rating: 5, comment: "" });
  const [trackOrderId, setTrackOrderId] = useState("");
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingError, setTrackingError] = useState("");

  const popularItemIds = useMemo(() => {
    const counts = new Map();

    todayOrders.forEach((order) => {
      String(order.items || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((entry) => {
          const name = entry.replace(/\s*x\d+$/i, "").trim().toLowerCase();
          counts.set(name, (counts.get(name) || 0) + 1);
        });
    });

    const byName = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);

    return new Set(
      menuItems
        .filter((item) => byName.includes(String(item.name || "").trim().toLowerCase()))
        .map((item) => String(item.id))
    );
  }, [menuItems, todayOrders]);

  const decoratedMenu = useMemo(
    () => menuItems.map((item, index) => decorateMenuItem(item, index, popularItemIds)),
    [menuItems, popularItemIds]
  );

  const categories = useMemo(() => {
    const values = new Set(decoratedMenu.map((item) => item.category));
    return [ALL_CATEGORY, ...values];
  }, [decoratedMenu]);

  const filteredMenu = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return decoratedMenu.filter((item) => {
      const matchesCategory = activeCategory === ALL_CATEGORY || item.category === activeCategory;
      const matchesQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query);

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, decoratedMenu, deferredSearch]);

  const featuredItemIds = useMemo(
    () =>
      decoratedMenu
        .slice()
        .sort((left, right) => Number(left.price) - Number(right.price))
        .slice(0, 3)
        .map((item) => String(item.id)),
    [decoratedMenu]
  );

  const totalPrice = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      ),
    [cartItems]
  );

  const totalUnits = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cartItems]
  );

  const estimatedPrepMinutes = useMemo(
    () => Math.min(30, Math.max(12, 8 + totalUnits * 2)),
    [totalUnits]
  );

  const averageRating = useMemo(() => {
    const values = Object.values(itemRatings).filter((entry) => Number(entry.reviewCount) > 0);
    if (!values.length) {
      return "4.8";
    }

    const total = values.reduce((sum, entry) => sum + Number(entry.rating || 0), 0);
    return (total / values.length).toFixed(1);
  }, [itemRatings]);

  const totalReviewCount = useMemo(
    () =>
      Object.values(itemRatings).reduce(
        (sum, entry) => sum + Number(entry.reviewCount || 0),
        0
      ),
    [itemRatings]
  );

  const currentOrder = useMemo(() => {
    if (!orderDetails) {
      return null;
    }

    return {
      ...orderDetails,
      status: inferLocalOrderStatus(orderDetails),
    };
  }, [orderDetails]);

  useEffect(() => {
    document.title = SITE_CONTENT.seoTitle;
  }, []);

  useEffect(() => {
    const syncOrders = () => setTodayOrders(readOrdersForDate(getTodayKey()));
    syncOrders();
    const intervalId = setInterval(syncOrders, 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let active = true;

    const loadReviews = async (items) => {
      const itemIds = items.map((item) => item.id);
      if (!itemIds.length) {
        return;
      }

      try {
        const nextReviews = await fetchReviewsByItemIds(itemIds);
        if (!active) {
          return;
        }
        setReviews(nextReviews);
        setItemRatings(getRatingsFromReviews(items, nextReviews));
      } catch {
        const fallbackReviews = {};
        items.forEach((item) => {
          fallbackReviews[item.id] = generateDemoReviews(item.name);
        });
        if (!active) {
          return;
        }
        setReviews(fallbackReviews);
        setItemRatings(getRatingsFromReviews(items, fallbackReviews));
      }
    };

    const loadMenu = async (silent = false) => {
      const cached = readCachedMenuItems();
      if (!silent && !cached.length) {
        setIsMenuLoading(true);
      }

      if (cached.length && !silent) {
        startTransition(() => {
          setMenuItems(cached);
          setIsMenuLoading(false);
        });
      }

      try {
        const items = await fetchActiveMenuItems();
        if (!active) {
          return;
        }

        startTransition(() => {
          setMenuItems(items);
          setMenuError("");
          setIsMenuLoading(false);
        });

        await loadReviews(items);
      } catch (error) {
        if (!active) {
          return;
        }

        const fallback = cached.length ? cached : FALLBACK_MENU_DATA;
        startTransition(() => {
          setMenuItems(fallback);
          setMenuError(
            cached.length
              ? ""
              : error?.message || "Menu is temporarily unavailable. Showing our fallback menu."
          );
          setIsMenuLoading(false);
        });
        await loadReviews(fallback);
      }
    };

    loadMenu(false);
    const refreshId = setInterval(() => loadMenu(true), MENU_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(refreshId);
    };
  }, []);

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(ALL_CATEGORY);
    }
  }, [activeCategory, categories]);

  useEffect(() => {
    if (!currentOrder?.orderId || !currentOrder?.orderDateKey) {
      return undefined;
    }

    const syncStatus = async () => {
      try {
        const remoteOrder = await fetchOrderStatusFromSheet({
          orderDateKey: currentOrder.orderDateKey,
          orderId: currentOrder.orderId,
        });

        if (!remoteOrder) {
          return;
        }

        setOrderDetails((previous) => {
          if (!previous || Number(previous.orderId) !== Number(currentOrder.orderId)) {
            return previous;
          }

          const merged = {
            ...previous,
            ...remoteOrder,
          };
          upsertOrderForDate(previous.orderDateKey, merged);
          return merged;
        });
      } catch {
        // Keep local status fallback alive even when the sheet endpoint is delayed.
      }
    };

    syncStatus();
    const intervalId = setInterval(syncStatus, STATUS_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [currentOrder?.orderDateKey, currentOrder?.orderId]);

  useEffect(() => {
    if (!currentOrder?.customer?.phone || !currentOrder?.orderDateKey || !currentOrder?.orderId) {
      return;
    }

    const notify = async () => {
      const sentKey = getWhatsAppSentKey(
        currentOrder.orderDateKey,
        currentOrder.orderId,
        currentOrder.status
      );

      if (localStorage.getItem(sentKey) === "1") {
        return;
      }

      try {
        await sendWhatsAppStatusNotification({
          customerPhone: currentOrder.customer.phone,
          customerName: currentOrder.customer.name,
          orderId: currentOrder.orderId,
          orderDateKey: currentOrder.orderDateKey,
          total: currentOrder.total,
          status: currentOrder.status,
        });
        localStorage.setItem(sentKey, "1");
      } catch {
        // Support fallback buttons cover this path.
      }
    };

    if (["payment_verified", "preparing", "ready_for_pickup", "delivered"].includes(currentOrder.status)) {
      notify();
    }
  }, [currentOrder]);

  const addToCart = (item, quantity = 1) => {
    setCartItems((previous) => {
      const existing = previous.find((entry) => String(entry.id) === String(item.id));
      if (existing) {
        return previous.map((entry) =>
          String(entry.id) === String(item.id)
            ? { ...entry, quantity: Math.min(10, entry.quantity + quantity) }
            : entry
        );
      }

      return [
        ...previous,
        {
          id: item.id,
          name: item.name,
          price: Number(item.price),
          image: item.image,
          badge: item.badge,
          quantity,
        },
      ];
    });
  };

  const decreaseCartItem = (itemId) => {
    setCartItems((previous) =>
      previous
        .map((item) =>
          String(item.id) === String(itemId)
            ? { ...item, quantity: Math.max(0, item.quantity - 1) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const increaseCartItem = (itemId) => {
    setCartItems((previous) =>
      previous.map((item) =>
        String(item.id) === String(itemId)
          ? { ...item, quantity: Math.min(10, item.quantity + 1) }
          : item
      )
    );
  };

  const removeCartItem = (itemId) => {
    setCartItems((previous) => previous.filter((item) => String(item.id) !== String(itemId)));
  };

  const openCheckout = () => {
    if (!cartItems.length || isSavingOrder) {
      return;
    }
    setCheckoutError("");
    setIsMobileCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const placeOrder = (event) => {
    event.preventDefault();

    const phone = customer.phone.trim();
    const email = customer.email.trim();
    const name = customer.name.trim();

    if (name.length < 2) {
      setCheckoutError("Please enter your full name.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setCheckoutError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCheckoutError("Please enter a valid email address or leave it blank.");
      return;
    }

    const dateKey = getTodayKey();
    const orderId = generateOrderId(dateKey);
    const createdAt = new Date().toISOString();
    const items = cartItems
      .map((item) => `${item.name} x${Number(item.quantity)}`)
      .join(", ");

    const nextOrder = {
      orderId,
      orderDateKey: dateKey,
      createdAt,
      paidAt: null,
      paymentMode: "upi",
      total: totalPrice,
      items,
      customer: {
        name,
        email,
        phone,
      },
      error: null,
      saving: false,
    };

    upsertOrderForDate(dateKey, nextOrder);
    setTodayOrders(readOrdersForDate(dateKey));
    setOrderDetails(nextOrder);
    setCartItems([]);
    setIsCheckoutOpen(false);
    setCheckoutError("");
  };

  const confirmPayment = async () => {
    if (!orderDetails) {
      return;
    }

    setOrderDetails((previous) => ({ ...previous, saving: true, error: null }));
    setIsSavingOrder(true);

    const paidAt = new Date().toISOString();

    try {
      const result = await appendOrderToSheet({
        orderId: orderDetails.orderId,
        orderDateKey: orderDetails.orderDateKey,
        customerName: orderDetails.customer.name,
        customerEmail: orderDetails.customer.email,
        customerPhone: orderDetails.customer.phone,
        items: orderDetails.items,
        total: orderDetails.total,
        timestamp: paidAt,
        status: "payment_verified",
      });

      const canonicalOrderId = Number(result.orderId || orderDetails.orderId);
      const nextOrder = {
        ...orderDetails,
        orderId: canonicalOrderId,
        paidAt,
        paymentMode: "upi",
        saving: false,
        error: null,
      };

      if (canonicalOrderId !== Number(orderDetails.orderId)) {
        replaceOrderIdForDate(orderDetails.orderDateKey, orderDetails.orderId, nextOrder);
      } else {
        upsertOrderForDate(orderDetails.orderDateKey, nextOrder);
      }

      setOrderDetails(nextOrder);
      setTodayOrders(readOrdersForDate(orderDetails.orderDateKey));
    } catch (error) {
      setOrderDetails((previous) => ({
        ...previous,
        saving: false,
        error:
          error?.message ||
          "We could not verify payment right now. Use WhatsApp or call for instant support.",
      }));
    } finally {
      setIsSavingOrder(false);
    }
  };

  const selectCashAtCounter = async () => {
    if (!orderDetails) {
      return;
    }

    setOrderDetails((previous) => ({ ...previous, saving: true, error: null }));
    setIsSavingOrder(true);

    try {
      const result = await appendOrderToSheet({
        orderId: orderDetails.orderId,
        orderDateKey: orderDetails.orderDateKey,
        customerName: orderDetails.customer.name,
        customerEmail: orderDetails.customer.email,
        customerPhone: orderDetails.customer.phone,
        items: orderDetails.items,
        total: orderDetails.total,
        timestamp: new Date().toISOString(),
        status: "pending_payment",
      });

      const canonicalOrderId = Number(result.orderId || orderDetails.orderId);
      const nextOrder = {
        ...orderDetails,
        orderId: canonicalOrderId,
        paymentMode: "cash_counter",
        saving: false,
        error: null,
      };

      if (canonicalOrderId !== Number(orderDetails.orderId)) {
        replaceOrderIdForDate(orderDetails.orderDateKey, orderDetails.orderId, nextOrder);
      } else {
        upsertOrderForDate(orderDetails.orderDateKey, nextOrder);
      }

      setOrderDetails(nextOrder);
      setTodayOrders(readOrdersForDate(orderDetails.orderDateKey));
    } catch (error) {
      setOrderDetails((previous) => ({
        ...previous,
        saving: false,
        error:
          error?.message ||
          "Cash-at-counter registration failed. Please contact the canteen directly.",
      }));
    } finally {
      setIsSavingOrder(false);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!reviewingItem || !newReview.comment.trim()) {
      return;
    }

    const review = {
      id: `review-${Date.now()}`,
      name: newReview.name.trim() || "Anonymous",
      rating: Number(newReview.rating),
      comment: newReview.comment.trim(),
      date: new Date().toISOString().slice(0, 10),
      helpfulCount: 0,
    };

    const nextReviews = {
      ...reviews,
      [reviewingItem.id]: [review, ...(reviews[reviewingItem.id] || [])],
    };

    setReviews(nextReviews);
    setItemRatings(getRatingsFromReviews(decoratedMenu, nextReviews));
    setIsReviewModalOpen(false);
    setReviewingItem(null);
    setNewReview({ name: "", rating: 5, comment: "" });

    try {
      await saveReviewForItem({ itemId: reviewingItem.id, review });
    } catch {
      // Local-first review entry keeps the experience smooth even if sync is delayed.
    }
  };

  const trackOrder = async () => {
    const parsedOrderId = Number(trackOrder.trim());
    if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
      setTrackingError("Enter a valid order ID.");
      setTrackedOrder(null);
      return;
    }

    setTrackingError("");

    try {
      const remoteOrder = await fetchOrderStatusFromSheet({ orderId: parsedOrderId });
      if (remoteOrder) {
        setTrackedOrder({
          ...remoteOrder,
          status: remoteOrder.sheetStatus || inferLocalOrderStatus(remoteOrder),
        });
        return;
      }
    } catch {
      // Fall back to local order cache.
    }

    const localOrder = findLocalOrderById(parsedOrderId);
    if (localOrder) {
      setTrackedOrder({ ...localOrder, status: inferLocalOrderStatus(localOrder) });
      return;
    }

    setTrackedOrder(null);
    setTrackingError(`Order #${parsedOrderId} was not found.`);
  };

  if (currentOrder) {
    return (
      <div className="app-shell">
        <Suspense fallback={<div className="page-loader">Loading order details...</div>}>
          <Confirmation
            order={currentOrder}
            onConfirmPayment={confirmPayment}
            onSelectCashAtCounter={selectCashAtCounter}
            onNewOrder={() => setOrderDetails(null)}
            business={SITE_CONTENT}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-row">
          <a href="/" className="brand-lockup" aria-label={SITE_CONTENT.name}>
            <img src="/logo.png" alt={SITE_CONTENT.name} className="brand-logo" />
            <div>
              <p className="eyebrow">Freshly prepared daily</p>
              <h1>{SITE_CONTENT.name}</h1>
            </div>
          </a>

          <div className="topbar-actions">
            <a href={SITE_CONTENT.callLink} className="soft-btn">
              Call now
            </a>
            <a
              href={SITE_CONTENT.whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="primary-btn"
            >
              Order on WhatsApp
            </a>
          </div>
        </div>
      </header>

      <main className="page-shell">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Snacks in Lucknow | Serving Since {SITE_CONTENT.since}</p>
            <h2>{SITE_CONTENT.heroHeading}</h2>
            <p>{SITE_CONTENT.heroSubheading}</p>

            <div className="hero-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() =>
                  document.getElementById("menu-search")?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
              >
                {SITE_CONTENT.primaryCta}
              </button>
              <button
                type="button"
                className="soft-btn"
                onClick={() =>
                  document.getElementById("menu-section")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
              >
                {SITE_CONTENT.secondaryCta}
              </button>
            </div>

            <div className="trust-row">
              <span>4.8 average rating</span>
              <span>Hygienic kitchen</span>
              <span>Fast delivery & pickup</span>
            </div>
          </div>

            <div className="hero-card">
            <div className="hero-card-top">
              <p>Trusted local ordering</p>
              <strong>{SITE_CONTENT.city}</strong>
            </div>
            <ul className="hero-stats">
              <li>
                <strong>{decoratedMenu.length}+</strong>
                <span>menu items</span>
              </li>
              <li>
                <strong>{averageRating}</strong>
                <span>guest rating</span>
              </li>
              <li>
                <strong>{estimatedPrepMinutes} mins</strong>
                <span>estimated prep</span>
              </li>
            </ul>
            <div className="hero-preview">
              <img
                src={heroImageSrc}
                alt="Fresh cheese vada pav served by Anupama Canteen"
                onError={() => setHeroImageSrc(SITE_CONTENT.heroImageFallback)}
              />
              <div className="hero-preview-overlay">
                <span>Freshly prepared</span>
                <strong>Lucknow quick bites, packed with care</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="trust-grid">
          {SITE_CONTENT.trustPoints.map((point) => (
            <article className="trust-card" key={point}>
              <p className="eyebrow">Why guests trust us</p>
              <h3>{point}</h3>
              <p>
                {point === "Serving Since 2010"
                  ? "A long-running local favourite for quick meals and snacks."
                  : point === "Hygienic Kitchen"
                    ? "Prepared with cleanliness, consistency, and better order confidence."
                    : point === "Freshly Prepared"
                      ? "Menu items are made to order for better taste and freshness."
                      : "Reliable for busy lunch breaks, evening hunger, and quick pickup."}
              </p>
            </article>
          ))}
        </section>

        <div className="content-grid">
          <div className="content-main">
            <Menu
              items={filteredMenu}
              totalItems={decoratedMenu.length}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              onClearFilters={() => {
                setSearchQuery("");
                setActiveCategory(ALL_CATEGORY);
              }}
              onAddToCart={addToCart}
              isLoading={isMenuLoading}
              error={menuError}
              onRetry={() => window.location.reload()}
              itemRatings={itemRatings}
              reviews={reviews}
              featuredItemIds={featuredItemIds}
              popularItemIds={[...popularItemIds]}
              onOpenReviewModal={(item) => {
                setReviewingItem(item);
                setIsReviewModalOpen(true);
              }}
            />
          </div>

          <aside className="content-side">
            <Cart
              items={cartItems}
              total={totalPrice}
              onDecrease={decreaseCartItem}
              onIncrease={increaseCartItem}
              onRemove={removeCartItem}
              onCheckout={openCheckout}
              estimatedPrepMinutes={estimatedPrepMinutes}
              isSavingOrder={isSavingOrder}
              error={checkoutError}
              whatsappLink={SITE_CONTENT.whatsappLink}
              callLink={SITE_CONTENT.callLink}
            />

            <section className="side-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Track order</p>
                  <h2>Order lookup</h2>
                </div>
              </div>
              <div className="track-form">
                <input
                  type="text"
                  inputMode="numeric"
                  value={trackOrderId}
                  onChange={(event) => setTrackOrderId(event.target.value)}
                  placeholder="Enter order ID"
                />
                <button type="button" className="primary-btn" onClick={trackOrder}>
                  Track
                </button>
              </div>
              {trackingError ? <p className="inline-error">{trackingError}</p> : null}
              {trackedOrder ? (
                <div className="status-card">
                  <p>
                    <strong>Order #{trackedOrder.orderId}</strong>
                  </p>
                  <p>Status: {STATUS_COPY[trackedOrder.status] || trackedOrder.status}</p>
                  <p>Total: Rs. {Number(trackedOrder.total || 0).toFixed(2)}</p>
                </div>
              ) : null}
            </section>

            <section className="side-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Reviews</p>
                  <h2>Social proof</h2>
                </div>
              </div>
              <div className="quote-stack">
                <blockquote>
                  <p>&quot;Fast ordering, quick pickup, and the snacks arrived fresh.&quot;</p>
                  <span>Local customer</span>
                </blockquote>
                <blockquote>
                  <p>&quot;Perfect for office cravings when we need reliable food in Lucknow.&quot;</p>
                  <span>Repeat customer</span>
                </blockquote>
                <div className="status-card success">
                  <p>
                    {averageRating}/5 average from {totalReviewCount || 40}+ visible reviews and
                    repeat guest feedback.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <p className="eyebrow">Serving since {SITE_CONTENT.since}</p>
            <h2>{SITE_CONTENT.name}</h2>
            <p>
              Fresh snacks, tea-time favourites, and quick meals for Lucknow customers who
              want fast ordering with real local trust.
            </p>
          </div>

          <div className="site-footer-grid">
            <div className="footer-detail-card">
              <span className="footer-icon" aria-hidden="true">
                <FiMapPin />
              </span>
              <div>
                <span>Address</span>
                <strong>{SITE_CONTENT.address}</strong>
              </div>
            </div>
            <div className="footer-detail-card">
              <span className="footer-icon" aria-hidden="true">
                <FiPhoneCall />
              </span>
              <div>
                <span>Phone</span>
                <strong>{SITE_CONTENT.displayPhone}</strong>
              </div>
            </div>
            <div className="footer-detail-card">
              <span className="footer-icon" aria-hidden="true">
                <FiShield />
              </span>
              <div>
                <span>FSSAI Number</span>
                <strong>{SITE_CONTENT.fssaiNumber}</strong>
              </div>
            </div>
          </div>

          <div className="site-footer-actions">
            <a href={SITE_CONTENT.callLink} className="soft-btn">
              Call now
            </a>
            <a
              href={SITE_CONTENT.whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="primary-btn"
            >
              WhatsApp order
            </a>
          </div>
        </div>
      </footer>

      <button
        type="button"
        className={`mobile-cart-trigger ${totalUnits ? "has-items" : ""}`}
        onClick={() => setIsMobileCartOpen(true)}
      >
        <span>{totalUnits ? `${totalUnits} items` : "Cart"}</span>
        <strong>Rs. {totalPrice.toFixed(0)}</strong>
      </button>

      {isMobileCartOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-sheet">
            <div className="modal-head">
              <h2>Cart</h2>
              <button type="button" className="link-btn" onClick={() => setIsMobileCartOpen(false)}>
                Close
              </button>
            </div>
            <Cart
              items={cartItems}
              total={totalPrice}
              onDecrease={decreaseCartItem}
              onIncrease={increaseCartItem}
              onRemove={removeCartItem}
              onCheckout={openCheckout}
              estimatedPrepMinutes={estimatedPrepMinutes}
              isSavingOrder={isSavingOrder}
              error={checkoutError}
              whatsappLink={SITE_CONTENT.whatsappLink}
              callLink={SITE_CONTENT.callLink}
            />
          </div>
        </div>
      ) : null}

      {isCheckoutOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-sheet">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Checkout</p>
                <h2>Customer details</h2>
              </div>
              <button type="button" className="link-btn" onClick={() => setIsCheckoutOpen(false)}>
                Close
              </button>
            </div>

            <form className="checkout-form" onSubmit={placeOrder}>
              <label htmlFor="customer-name">Name</label>
              <input
                id="customer-name"
                value={customer.name}
                onChange={(event) =>
                  setCustomer((previous) => ({ ...previous, name: event.target.value }))
                }
                placeholder="Enter your name"
                required
              />

              <label htmlFor="customer-phone">Phone number</label>
              <input
                id="customer-phone"
                inputMode="numeric"
                value={customer.phone}
                onChange={(event) =>
                  setCustomer((previous) => ({ ...previous, phone: event.target.value }))
                }
                placeholder="10-digit mobile number"
                required
              />

              <label htmlFor="customer-email">Email (optional)</label>
              <input
                id="customer-email"
                type="email"
                value={customer.email}
                onChange={(event) =>
                  setCustomer((previous) => ({ ...previous, email: event.target.value }))
                }
                placeholder="Email for order updates"
              />

              <div className="status-card">
                <p>
                  After placing the order, you can pay via UPI or use the cash-at-counter fallback.
                </p>
              </div>

              {checkoutError ? <p className="inline-error">{checkoutError}</p> : null}

              <div className="modal-actions">
                <a
                  href={createWhatsAppOrderLink({
                    customerName: customer.name,
                    total: totalPrice,
                    items: cartItems.map((item) => `${item.name} x${item.quantity}`).join(", "),
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="soft-btn"
                >
                  WhatsApp instead
                </a>
                <button type="submit" className="primary-btn">
                  Save order
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isReviewModalOpen && reviewingItem ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-sheet">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Review item</p>
                <h2>{reviewingItem.name}</h2>
              </div>
              <button
                type="button"
                className="link-btn"
                onClick={() => setIsReviewModalOpen(false)}
              >
                Close
              </button>
            </div>

            <form className="checkout-form" onSubmit={submitReview}>
              <label htmlFor="reviewer-name">Name</label>
              <input
                id="reviewer-name"
                value={newReview.name}
                onChange={(event) =>
                  setNewReview((previous) => ({ ...previous, name: event.target.value }))
                }
                placeholder="Your name"
              />

              <label htmlFor="review-rating">Rating</label>
              <select
                id="review-rating"
                value={newReview.rating}
                onChange={(event) =>
                  setNewReview((previous) => ({
                    ...previous,
                    rating: Number(event.target.value),
                  }))
                }
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option value={value} key={value}>
                    {value} / 5
                  </option>
                ))}
              </select>

              <label htmlFor="review-comment">Review</label>
              <textarea
                id="review-comment"
                rows="4"
                value={newReview.comment}
                onChange={(event) =>
                  setNewReview((previous) => ({ ...previous, comment: event.target.value }))
                }
                placeholder="Tell future customers what you liked."
                required
              />

              <div className="modal-actions">
                <button type="submit" className="primary-btn">
                  Publish review
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Floating WhatsApp Order Button */}
      <a
        href={SITE_CONTENT.whatsappLink}
        target="_blank"
        rel="noreferrer"
        className="floating-whatsapp-btn"
        aria-label="Order on WhatsApp"
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554-0.049 11.89-4.837 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        <span>Order on WhatsApp</span>
      </a>
      <p className="floating-whatsapp-subtext">Browse menu &amp; order instantly on WhatsApp</p>
    </div>
  );
}

export default App;
