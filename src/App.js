import { useCallback, useEffect, useMemo, useState } from "react";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import Confirmation from "./components/Confirmation";
import {
  appendOrderToSheet,
  fetchActiveMenuItems,
  fetchOrderStatusFromSheet,
  readCachedMenuItems,
  FALLBACK_MENU_DATA,
} from "./services/sheetsService";
import { fetchReviewsByItemIds, saveReviewForItem } from "./services/reviewService";
import { sendWhatsAppStatusNotification } from "./services/whatsappService";
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

const MENU_REFRESH_INTERVAL_MS = 300000; // 5 minutes instead of 30 seconds
const STATUS_TICK_INTERVAL_MS = 1000;
const DEFAULT_CATEGORY = "Popular";
const ALL_CATEGORIES = "All";
const PREPARING_START_MS = 20000;
const READY_START_MS = 50000;
const ORDERS_STORAGE_KEY_PREFIX = "anupama:orders:";
const ORDER_COUNTER_KEY_PREFIX = "anupama:orderCounter:";
const WHATSAPP_SENT_KEY_PREFIX = "anupama:whatsappSent:";

// Generate demo reviews for an item
const generateDemoReviews = (itemName) => {
  const reviewTemplates = [
    { text: "Amazing taste! Fresh and delicious. Will definitely order again.", rating: 5 },
    { text: "Good quality and fast service. Perfect for a quick snack.", rating: 4 },
    { text: "Tasty but a bit spicy for my liking. Overall good experience.", rating: 4 },
    { text: "Fresh ingredients and great packaging. Highly recommended!", rating: 5 },
    { text: "Decent taste but could be better. Value for money though.", rating: 3 },
    { text: "Love it! Always consistent quality and quick delivery.", rating: 5 },
    { text: "Good portion size and reasonable price. Happy with the order.", rating: 4 },
    { text: "Could be hotter when delivered, but taste is excellent.", rating: 4 },
    { text: "Best in town! Authentic flavors and fresh preparation.", rating: 5 },
    { text: "Satisfactory. Nothing extraordinary but meets expectations.", rating: 3 },
    { text: "Perfect for office lunch. Quick and tasty!", rating: 4 },
    { text: "Great value for money. Will try other items too.", rating: 4 },
  ];

  const numReviews = Math.floor(Math.random() * 4) + 3; // 3-6 reviews
  const shuffled = [...reviewTemplates].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, numReviews);

  return selected.map((template, index) => ({
    id: `${itemName.toLowerCase().replace(/\s+/g, '-')}-review-${index + 1}`,
    name: ["Rahul S.", "Priya M.", "Amit K.", "Sneha P.", "Vikram R.", "Anjali T."][index % 6],
    rating: template.rating,
    comment: template.text,
    date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Random date within last 30 days
    helpfulCount: Math.max(0, Math.floor(Math.random() * 35) + (template.rating >= 4 ? 8 : 2)),
  }));
};

const getRatingsFromReviews = (items, reviewsByItem) => {
  const ratings = {};

  items.forEach((item) => {
    const itemReviews = Array.isArray(reviewsByItem?.[item.id]) ? reviewsByItem[item.id] : [];
    if (!itemReviews.length) {
      ratings[item.id] = {
        rating: 0,
        reviewCount: 0,
      };
      return;
    }

    const totalRating = itemReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    ratings[item.id] = {
      rating: Math.round((totalRating / itemReviews.length) * 10) / 10,
      reviewCount: itemReviews.length,
    };
  });

  return ratings;
};

const STATUS_TEXT = {
  pending_payment: "Awaiting payment",
  payment_verified: "Payment verified",
  preparing: "Preparing order",
  ready_for_pickup: "Ready for pickup",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const getTodayDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getOrdersKey = (dateKey) => `${ORDERS_STORAGE_KEY_PREFIX}${dateKey}`;
const getOrderCounterKey = (dateKey) => `${ORDER_COUNTER_KEY_PREFIX}${dateKey}`;
const getWhatsAppSentKey = (orderDateKey, orderId, status) =>
  `${WHATSAPP_SENT_KEY_PREFIX}${orderDateKey}:${orderId}:${status}`;

const FALLBACK_BRAND_LOGO = "/logo.png";

const readOrdersForDate = (dateKey) => {
  try {
    const raw = localStorage.getItem(getOrdersKey(dateKey));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const findLocalOrderById = (targetOrderId) => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(ORDERS_STORAGE_KEY_PREFIX)) {
        continue;
      }

      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        continue;
      }

      const match = parsed.find((record) => Number(record?.orderId) === Number(targetOrderId));
      if (match) {
        return match;
      }
    }
  } catch {
    return null;
  }

  return null;
};

const writeOrdersForDate = (dateKey, records) => {
  localStorage.setItem(getOrdersKey(dateKey), JSON.stringify(records));
};

const generateFreshOrderId = (dateKey) => {
  const localMax = readOrdersForDate(dateKey).reduce((maxId, record) => {
    const id = Number(record?.orderId);
    return Number.isInteger(id) && id > maxId ? id : maxId;
  }, 0);

  try {
    const counterKey = getOrderCounterKey(dateKey);
    const stored = Number(localStorage.getItem(counterKey) || 0);
    const next = Math.max(localMax, Number.isInteger(stored) ? stored : 0) + 1;
    localStorage.setItem(counterKey, String(next));
    return next;
  } catch {
    return localMax + 1;
  }
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

const replaceOrderRecordForDate = (dateKey, previousOrderId, nextOrderRecord) => {
  const records = readOrdersForDate(dateKey).filter(
    (record) =>
      Number(record?.orderId) !== Number(previousOrderId) &&
      Number(record?.orderId) !== Number(nextOrderRecord?.orderId)
  );

  records.push(nextOrderRecord);
  writeOrdersForDate(dateKey, records);
};

const deriveStatus = (orderRecord, nowMs) => {
  if (orderRecord?.sheetStatus) {
    return orderRecord.sheetStatus;
  }

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

const normalizeItemName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const parseOrderItems = (value) => {
  const rawText = String(value || "").trim();
  if (!rawText) {
    return [];
  }

  return rawText
    .split(/\s*,\s*/)
    .map((part) => {
      const match = part.match(/^(.*?)(?:\s*x\s*(\d+))?$/i);
      const name = normalizeItemName(match?.[1] || part);
      const qty = Number(match?.[2] || 1);
      return {
        name,
        qty: Number.isInteger(qty) && qty > 0 ? qty : 1,
      };
    })
    .filter((entry) => entry.name);
};

const BrandStrip = () => {
  const brands = [
    { src: amul, label: "Amul" },
    { src: campa, label: "Campa" },
    { src: coke, label: "Coca-Cola" },
    { src: heinz, label: "Heinz" },
    { src: hellman, label: "Hellmann's" },
    { src: maggi, label: "Maggi" },
    { src: mdh, label: "MDH" },
    { src: nestle, label: "Nestle" },
    { src: veeba, label: "Veeba" },
    { src: "/brands/kissan.png", label: "Kissan" },
    { src: "/brands/knorr.png", label: "Knorr" },
    { src: "/brands/everest.png", label: "Everest" },
    { src: "/brands/mtr.png", label: "MTR" },
    { src: "/brands/chings.png", label: "Ching's" },
  ];

  return (
    <div className="brand-strip">
      {brands.map((logo, index) => (
        <img
          key={index}
          src={logo.src}
          className="brand-strip-logo"
          alt={`${logo.label} brand logo`}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = FALLBACK_BRAND_LOGO;
          }}
        />
      ))}
    </div>
  );
};

const BrandLogosSection = () => {
  const leftBrands = [
    { src: amul, label: "Amul" },
    { src: campa, label: "Campa" },
    { src: coke, label: "Coca-Cola" },
    { src: heinz, label: "Heinz" },
    { src: "/brands/knorr.png", label: "Knorr" },
  ];

  const rightBrands = [
    { src: maggi, label: "Maggi" },
    { src: mdh, label: "MDH" },
    { src: nestle, label: "Nestle" },
    { src: veeba, label: "Veeba" },
    { src: "/brands/mtr.png", label: "MTR" },
  ];

  return (
    <>
      {/* Left side brand logos */}
      <div className="brands-section">
        {leftBrands.map((logo, index) => (
          <div key={`left-${index}`} className="brand-logo-item">
            <img
              src={logo.src}
              alt={`${logo.label} brand`}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = FALLBACK_BRAND_LOGO;
              }}
            />
          </div>
        ))}
      </div>

      {/* Right side brand logos */}
      <div className="brands-section-right">
        {rightBrands.map((logo, index) => (
          <div key={`right-${index}`} className="brand-logo-item">
            <img
              src={logo.src}
              alt={`${logo.label} brand`}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = FALLBACK_BRAND_LOGO;
              }}
            />
          </div>
        ))}
      </div>
    </>
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
  const [isFloatingCartOpen, setIsFloatingCartOpen] = useState(false);
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [statusNowMs, setStatusNowMs] = useState(Date.now());
  const [trackOrderIdInput, setTrackOrderIdInput] = useState("");
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingError, setTrackingError] = useState("");
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [todayOrders, setTodayOrders] = useState([]);
  const [reviews, setReviews] = useState({});
  const [itemRatings, setItemRatings] = useState({});
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingItem, setReviewingItem] = useState(null);
  const [newReview, setNewReview] = useState({
    name: "",
    rating: 5,
    comment: "",
  });

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

  const quickPickIds = useMemo(() => {
    const picks = [...menuItemsWithCategory]
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, 3)
      .map((item) => String(item.id));
    return new Set(picks);
  }, [menuItemsWithCategory]);

  const estimatedPrepMinutes = useMemo(() => {
    if (!cartItems.length) {
      return 10;
    }
    return Math.min(25, 8 + cartItems.length * 2);
  }, [cartItems.length]);

  const cartUnitCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0),
    [cartItems]
  );

  const averageMenuRating = useMemo(() => {
    const values = Object.values(itemRatings);
    if (!values.length) {
      return "4.8";
    }

    const totalRating = values.reduce((sum, entry) => sum + Number(entry?.rating || 0), 0);
    return (totalRating / values.length).toFixed(1);
  }, [itemRatings]);

  const totalReviewCount = useMemo(
    () =>
      Object.values(itemRatings).reduce(
        (sum, entry) => sum + Number(entry?.reviewCount || 0),
        0
      ),
    [itemRatings]
  );

  useEffect(() => {
    setTodayOrders(readOrdersForDate(getTodayDateKey()));
  }, [ordersRefreshKey]);

  const mostOrderedToday = useMemo(() => {
    const menuByName = new Map(
      menuItemsWithCategory.map((item) => [normalizeItemName(item.name), item])
    );
    const itemCounts = new Map();

    todayOrders.forEach((order) => {
      parseOrderItems(order?.items).forEach((entry) => {
        const menuItem = menuByName.get(entry.name);
        if (!menuItem) {
          return;
        }
        const current = itemCounts.get(menuItem.id) || {
          item: menuItem,
          count: 0,
        };
        current.count += entry.qty;
        itemCounts.set(menuItem.id, current);
      });
    });

    return [...itemCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [todayOrders, menuItemsWithCategory]);

  const frequentlyBoughtTogether = useMemo(() => {
    const menuByName = new Map(
      menuItemsWithCategory.map((item) => [normalizeItemName(item.name), item])
    );
    const pairCounts = new Map();

    todayOrders.forEach((order) => {
      const uniqueIds = new Set();
      parseOrderItems(order?.items).forEach((entry) => {
        const menuItem = menuByName.get(entry.name);
        if (menuItem?.id !== undefined && menuItem?.id !== null) {
          uniqueIds.add(String(menuItem.id));
        }
      });

      const ids = [...uniqueIds];
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const [a, b] = [ids[i], ids[j]].sort();
          const key = `${a}::${b}`;
          pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        }
      }
    });

    const byId = new Map(menuItemsWithCategory.map((item) => [String(item.id), item]));
    const rankedPairs = [...pairCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => {
        const [leftId, rightId] = key.split("::");
        const left = byId.get(leftId);
        const right = byId.get(rightId);
        if (!left || !right) {
          return null;
        }
        return {
          id: key,
          left,
          right,
          count,
          totalPrice: Number(left.price) + Number(right.price),
        };
      })
      .filter(Boolean);

    if (rankedPairs.length) {
      return rankedPairs.slice(0, 3);
    }

    const fallback = [...menuItemsWithCategory]
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, 4);

    if (fallback.length < 2) {
      return [];
    }

    const fallbackPairs = [];
    for (let i = 0; i < fallback.length - 1 && fallbackPairs.length < 2; i += 1) {
      const left = fallback[i];
      const right = fallback[i + 1];
      fallbackPairs.push({
        id: `${left.id}::${right.id}`,
        left,
        right,
        count: 0,
        totalPrice: Number(left.price) + Number(right.price),
      });
    }
    return fallbackPairs;
  }, [todayOrders, menuItemsWithCategory]);

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
    const { silent = false, force = false } = options;

    // Always try to show cached data immediately for better UX
    const cachedItems = readCachedMenuItems();
    if (cachedItems.length > 0 && !force) {
      setMenuItems(cachedItems);
      setIsMenuLoading(false);

      // Load reviews for cached items
      const itemIds = cachedItems.map((item) => item.id);
      try {
        const reviewsData = await fetchReviewsByItemIds(itemIds);
        const ratings = getRatingsFromReviews(cachedItems, reviewsData);
        setReviews(reviewsData);
        setItemRatings(ratings);
      } catch {
        // Use demo reviews if API fails
        const demoReviews = {};
        cachedItems.forEach((item) => {
          demoReviews[item.id] = generateDemoReviews(item.name);
        });
        const ratings = getRatingsFromReviews(cachedItems, demoReviews);
        setReviews(demoReviews);
        setItemRatings(ratings);
      }
    } else if (!force) {
      // Show fallback menu immediately if no cached data
      setMenuItems(FALLBACK_MENU_DATA);
      setIsMenuLoading(false);

      // Load demo reviews for fallback items
      const demoReviews = {};
      FALLBACK_MENU_DATA.forEach((item) => {
        demoReviews[item.id] = generateDemoReviews(item.name);
      });
      const ratings = getRatingsFromReviews(FALLBACK_MENU_DATA, demoReviews);
      setReviews(demoReviews);
      setItemRatings(ratings);
    }

    if (!silent && cachedItems.length === 0 && !force) {
      setIsMenuLoading(true);
      setMenuError("");
    }

    try {
      const items = await fetchActiveMenuItems();
      const hasNewData = items.length !== cachedItems.length ||
        JSON.stringify(items) !== JSON.stringify(cachedItems);

      if (hasNewData || force) {
        setMenuItems(items);

        const itemIds = items.map((item) => item.id);
        let reviewsData = {};
        try {
          reviewsData = await fetchReviewsByItemIds(itemIds);
        } catch {
          // Fallback keeps UI usable when reviews backend is not yet configured.
          reviewsData = {};
          items.forEach((item) => {
            reviewsData[item.id] = generateDemoReviews(item.name);
          });
        }

        const ratings = getRatingsFromReviews(items, reviewsData);
        setReviews(reviewsData);
        setItemRatings(ratings);
      }
    } catch (error) {
      if (!silent && cachedItems.length === 0) {
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

  const notifyWhatsAppForStatus = useCallback(async (orderRecord, status) => {
    if (!orderRecord?.customer?.phone || !orderRecord?.orderDateKey || !orderRecord?.orderId) {
      return;
    }

    const sentKey = getWhatsAppSentKey(
      orderRecord.orderDateKey,
      orderRecord.orderId,
      status
    );
    if (localStorage.getItem(sentKey) === "1") {
      return;
    }

    try {
      await sendWhatsAppStatusNotification({
        customerPhone: orderRecord.customer.phone,
        customerName: orderRecord.customer.name,
        orderId: orderRecord.orderId,
        orderDateKey: orderRecord.orderDateKey,
        total: orderRecord.total,
        status,
      });
      localStorage.setItem(sentKey, "1");
    } catch (error) {
      // keep checkout/status flow working even if WhatsApp service is temporarily down
      console.error("WhatsApp notification failed", error);
    }
  }, []);

  useEffect(() => {
    if (
      !orderDetails?.orderId ||
      !orderDetails?.orderDateKey ||
      (!orderDetails?.paidAt && orderDetails?.paymentMode !== "cash_counter")
    ) {
      return undefined;
    }

    let active = true;

    const pullStatus = async () => {
      try {
        const remoteOrder = await fetchOrderStatusFromSheet({
          orderDateKey: orderDetails.orderDateKey,
          orderId: orderDetails.orderId,
        });

        if (
          !active ||
          !remoteOrder ||
          Number(remoteOrder.orderId) !== Number(orderDetails.orderId)
        ) {
          return;
        }

        setOrderDetails((prev) => {
          if (!prev || prev.orderId !== orderDetails.orderId) {
            return prev;
          }

          const merged = {
            ...prev,
            ...remoteOrder,
            saving: false,
            error: null,
          };

          upsertOrderForDate(prev.orderDateKey, merged);
          setOrdersRefreshKey((key) => key + 1);
          return merged;
        });
      } catch {
        // fallback to local timer status if sheet polling fails
      }
    };

    pullStatus();
    const intervalId = setInterval(pullStatus, 10000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [
    orderDetails?.orderId,
    orderDetails?.orderDateKey,
    orderDetails?.paidAt,
    orderDetails?.paymentMode,
  ]);

  useEffect(() => {
    if (!trackedOrder?.orderId || !trackedOrder?.orderDateKey) {
      return undefined;
    }

    let active = true;

    const pullStatus = async () => {
      try {
        const remoteOrder = await fetchOrderStatusFromSheet({
          orderDateKey: trackedOrder.orderDateKey,
          orderId: trackedOrder.orderId,
        });

        if (
          !active ||
          !remoteOrder ||
          Number(remoteOrder.orderId) !== Number(trackedOrder.orderId)
        ) {
          return;
        }

        setTrackedOrder((prev) =>
          prev && prev.orderId === trackedOrder.orderId
            ? {
                ...prev,
                ...remoteOrder,
              }
            : prev
        );
      } catch {
        // keep showing current data
      }
    };

    pullStatus();
    const intervalId = setInterval(pullStatus, 10000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [trackedOrder?.orderId, trackedOrder?.orderDateKey]);

  useEffect(() => {
    if (!currentOrder?.orderId || !currentOrder?.orderDateKey) {
      return;
    }

    if (["preparing", "ready_for_pickup", "delivered"].includes(currentOrder.status)) {
      notifyWhatsAppForStatus(currentOrder, currentOrder.status);
    }
  }, [
    currentOrder,
    currentOrder?.orderId,
    currentOrder?.orderDateKey,
    currentOrder?.status,
    currentOrder?.customer?.phone,
    notifyWhatsAppForStatus,
  ]);

  const addToCart = (item) => {
    setCartItems((prev) => [...prev, item]);
  };

  const addBundleToCart = (bundle) => {
    if (!bundle?.left || !bundle?.right) {
      return;
    }

    const leftPrice = Number(bundle.left.price);
    const rightPrice = Number(bundle.right.price);

    setCartItems((prev) => [
      ...prev,
      {
        ...bundle.left,
        quantity: 1,
        unitPrice: leftPrice,
        price: leftPrice,
      },
      {
        ...bundle.right,
        quantity: 1,
        unitPrice: rightPrice,
        price: rightPrice,
      },
    ]);
  };

  const removeFromCart = (indexToRemove) => {
    setCartItems((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const openCheckoutModal = () => {
    if (!cartItems.length || isSavingOrder) {
      return;
    }

    setCheckoutError("");
    setIsFloatingCartOpen(false);
    setIsCheckoutModalOpen(true);
  };

  const closeCheckoutModal = () => {
    if (isSavingOrder) {
      return;
    }

    setIsCheckoutModalOpen(false);
  };

  const toggleFloatingCart = () => {
    setIsFloatingCartOpen((prev) => !prev);
  };

  const openReviewModal = (item) => {
    setReviewingItem(item);
    setNewReview({
      name: "",
      rating: 5,
      comment: "",
    });
    setIsReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    setIsReviewModalOpen(false);
    setReviewingItem(null);
  };

  const submitReview = () => {
    if (!reviewingItem || !newReview.comment.trim()) {
      return;
    }

    const reviewData = {
      id: `user-review-${Date.now()}`,
      name: newReview.name.trim() || "Anonymous",
      rating: newReview.rating,
      comment: newReview.comment.trim(),
      date: new Date().toISOString().split('T')[0],
      helpfulCount: 0,
    };

    setReviews((prev) => ({
      ...prev,
      [reviewingItem.id]: [reviewData, ...(prev[reviewingItem.id] || [])],
    }));

    const currentReviews = [...(reviews[reviewingItem.id] || []), reviewData];
    const avgRating = currentReviews.reduce((sum, r) => sum + r.rating, 0) / currentReviews.length;
    setItemRatings((prev) => ({
      ...prev,
      [reviewingItem.id]: {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: currentReviews.length,
      },
    }));

    closeReviewModal();

    saveReviewForItem({
      itemId: reviewingItem.id,
      review: reviewData,
    }).catch((error) => {
      console.error("Review sync failed:", error?.message || error);
    });
  };

  const onReviewFieldChange = (field, value) => {
    setNewReview((prev) => ({ ...prev, [field]: value }));
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
    const orderId = generateFreshOrderId(todayKey);
    const createdAt = new Date().toISOString();
    const items = cartItems.map((item) => `${item.name} x${item.quantity || 1}`).join(", ");

    const newOrder = {
      orderId,
      orderDateKey: todayKey,
      createdAt,
      paidAt: null,
      paymentMode: "upi",
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
    setOrdersRefreshKey((key) => key + 1);
    setOrderDetails(newOrder);
    notifyWhatsAppForStatus(newOrder, "order_placed");
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
      paymentMode: "upi",
      saving: false,
      error: null,
    };

    try {
      const appendResult = await appendOrderToSheet({
        orderId: updatedOrder.orderId,
        orderDateKey: updatedOrder.orderDateKey,
        customerName: updatedOrder.customer.name,
        customerEmail: updatedOrder.customer.email,
        customerPhone: updatedOrder.customer.phone,
        items: updatedOrder.items,
        total: updatedOrder.total,
        timestamp: nowIso,
        status: "payment_verified",
      });
      const canonicalOrderId = Number(appendResult?.orderId);
      const mergedOrder =
        Number.isInteger(canonicalOrderId) && canonicalOrderId > 0
          ? { ...updatedOrder, orderId: canonicalOrderId }
          : updatedOrder;

      if (mergedOrder.orderId !== updatedOrder.orderId) {
        replaceOrderRecordForDate(
          mergedOrder.orderDateKey,
          updatedOrder.orderId,
          mergedOrder
        );
      } else {
        upsertOrderForDate(mergedOrder.orderDateKey, mergedOrder);
      }
      setOrdersRefreshKey((key) => key + 1);
      setOrderDetails(mergedOrder);
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

  const selectCashAtCounter = async () => {
    if (!orderDetails) {
      return;
    }

    setOrderDetails((prev) => ({ ...prev, saving: true, error: null }));

    const nowIso = new Date().toISOString();
    const updatedOrder = {
      ...orderDetails,
      paymentMode: "cash_counter",
      saving: false,
      error: null,
    };

    try {
      const appendResult = await appendOrderToSheet({
        orderId: updatedOrder.orderId,
        orderDateKey: updatedOrder.orderDateKey,
        customerName: updatedOrder.customer.name,
        customerEmail: updatedOrder.customer.email,
        customerPhone: updatedOrder.customer.phone,
        items: updatedOrder.items,
        total: updatedOrder.total,
        timestamp: nowIso,
        status: "pending_payment",
      });
      const canonicalOrderId = Number(appendResult?.orderId);
      const mergedOrder =
        Number.isInteger(canonicalOrderId) && canonicalOrderId > 0
          ? { ...updatedOrder, orderId: canonicalOrderId }
          : updatedOrder;

      if (mergedOrder.orderId !== updatedOrder.orderId) {
        replaceOrderRecordForDate(
          mergedOrder.orderDateKey,
          updatedOrder.orderId,
          mergedOrder
        );
      } else {
        upsertOrderForDate(mergedOrder.orderDateKey, mergedOrder);
      }
      setOrdersRefreshKey((key) => key + 1);
      setOrderDetails(mergedOrder);
    } catch (error) {
      setOrderDetails((prev) => ({
        ...prev,
        saving: false,
        error:
          error?.message ||
          "Unable to register cash-at-counter option. Check your connection and try again.",
      }));
    }
  };

  const trackOrderById = async () => {
    setTrackingError("");

    const trimmed = trackOrderIdInput.trim();
    const parsedId = Number(trimmed);
    if (!trimmed || !Number.isInteger(parsedId) || parsedId <= 0) {
      setTrackedOrder(null);
      setTrackingError("Enter a valid numeric order ID.");
      return;
    }

    const todayKey = getTodayDateKey();

    try {
      const remoteOrder = await fetchOrderStatusFromSheet({
        orderId: parsedId,
      });

      if (remoteOrder) {
        setTrackedOrder({
          ...remoteOrder,
          orderDateKey: remoteOrder.orderDateKey || todayKey,
        });
        return;
      }
    } catch {
      // fallback to local cache
    }

    const localOrder = findLocalOrderById(parsedId);

    if (localOrder) {
      setTrackedOrder(localOrder);
      return;
    }

    setTrackedOrder(null);
    setTrackingError(`Order #${parsedId} not found.`);
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
          onSelectCashAtCounter={selectCashAtCounter}
          onNewOrder={startNewOrder}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header sticky-header">
        <div className="header-content">
          <div className="brand-row">
            <img src="/logo.png" alt="Anupama Canteen logo" className="brand-logo" />
            <div>
              <h1>Anupama Canteen</h1>
              <p>Fresh snacks. Fast ordering. Smooth pickup.</p>
            </div>
          </div>
          <button
            type="button"
            className="header-cart-btn"
            onClick={toggleFloatingCart}
            aria-label={`Cart with ${cartUnitCount} items`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7.2 14h9.9c.9 0 1.7-.5 2.1-1.3l3.3-6.1a1 1 0 0 0-.9-1.5H6.1L5.4 2H2v2h2l2.5 9.5a2 2 0 0 0 1.9 1.5z" />
            </svg>
            {cartUnitCount > 0 && (
              <span className="header-cart-count">{cartUnitCount}</span>
            )}
          </button>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-gradient"></div>
        </div>
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Fresh Food,<br />
              <span className="hero-title-accent">Fast Delivery</span>
            </h1>
            <p className="hero-subtitle">
              Premium quality meals prepared with care. From traditional favorites to modern delights,
              delivered hot and fresh to your doorstep.
            </p>
            <div className="hero-actions">
              <button className="hero-primary-btn" onClick={() => {
                const target = document.getElementById("menu-search");
                if (!target) return;
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                target.focus();
              }}>
                🍽️ Order Now
              </button>
              <button className="hero-secondary-btn" onClick={() => {
                const target = document.getElementById("snack-menu");
                if (!target) return;
                target.scrollIntoView({ behavior: "smooth", block: "start" });
              }}>
                📖 View Menu
              </button>
            </div>
            <div className="hero-features">
              <div className="feature-item">
                <span className="feature-icon">⚡</span>
                <span>Under 30 mins</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">⭐</span>
                <span>4.8/5 Rating</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🛡️</span>
                <span>Hygienic & Fresh</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💳</span>
                <span>Easy Payment</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-container">
              <img src="/menu-placeholder.svg" alt="Delicious food" className="hero-main-image" />
            </div>
          </div>
        </div>
      </section>

      <section className="decision-banner">
        <div className="decision-banner-head">
          <div>
            <h2>Built For Fast, Reliable Snack Decisions</h2>
            <p>Cleaner ordering flow, stronger trust signals, faster checkout confidence.</p>
          </div>
          <button
            type="button"
            className="decision-cta-btn"
            onClick={() => {
              const target = document.getElementById("menu-search");
              if (!target) {
                return;
              }
              target.scrollIntoView({ behavior: "smooth", block: "center" });
              target.focus();
            }}
          >
            Explore Best Picks
          </button>
        </div>
        <div className="trust-signals">
          <div className="trust-signal">
            <span className="trust-icon">🛡️</span>
            <div>
              <strong>Hygienic & Fresh</strong>
              <p>Prepared daily with premium ingredients</p>
            </div>
          </div>
          <div className="trust-signal">
            <span className="trust-icon">⚡</span>
            <div>
              <strong>Fast Delivery</strong>
              <p>Pickup in {estimatedPrepMinutes} mins</p>
            </div>
          </div>
          <div className="trust-signal">
            <span className="trust-icon">📱</span>
            <div>
              <strong>Live Tracking</strong>
              <p>WhatsApp status updates</p>
            </div>
          </div>
          <div className="trust-signal">
            <span className="trust-icon">⭐</span>
            <div>
              <strong>{averageMenuRating}/5 Rating</strong>
              <p>{totalReviewCount}+ customer reviews</p>
            </div>
          </div>
        </div>
      </section>
      <main className="main-layout" id="menu-section">
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
          quickPickIds={quickPickIds}
          mostOrderedToday={mostOrderedToday}
          frequentlyBoughtTogether={frequentlyBoughtTogether}
          onAddBundle={addBundleToCart}
          itemRatings={itemRatings}
          reviews={reviews}
          onOpenReviewModal={openReviewModal}
        />
        <div className="sidebar-stack">
          <div className="sidebar-cart-slot">
            <Cart
              items={cartItems}
              total={totalPrice}
              onRemove={removeFromCart}
              onCheckout={openCheckoutModal}
              isSavingOrder={isSavingOrder}
              error={checkoutError}
              estimatedPrepMinutes={estimatedPrepMinutes}
            />
          </div>
          <section className="panel track-panel">
            <div className="panel-head">
              <h2>Track Your Order</h2>
              <span className="panel-label">By Order ID</span>
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
                  <strong>Status:</strong>{" "}
                  {STATUS_TEXT[liveTrackedOrder.status] || liveTrackedOrder.status || "Unknown"}
                </p>
                <p>
                  <strong>Total:</strong> Rs. {Number(liveTrackedOrder.total).toFixed(2)}
                </p>
                <p>
                  <strong>Date:</strong> {liveTrackedOrder.orderDateKey || "Not available"}
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <BrandStrip />

      <BrandLogosSection />

      <button
        type="button"
        className={`floating-cart-btn ${cartItems.length ? "has-items" : ""}`}
        onClick={toggleFloatingCart}
        aria-label={cartItems.length ? `Open cart with ${cartUnitCount} items` : "Open empty cart"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7.2 14h9.9c.9 0 1.7-.5 2.1-1.3l3.3-6.1a1 1 0 0 0-.9-1.5H6.1L5.4 2H2v2h2l2.5 9.5a2 2 0 0 0 1.9 1.5z" />
        </svg>
        <span className="floating-cart-label">Cart</span>
        <span className="floating-cart-count">{cartUnitCount}</span>
      </button>

      {isFloatingCartOpen ? (
        <div className="floating-cart-overlay" role="dialog" aria-modal="true">
          <div className="floating-cart-panel-wrap">
            <div className="floating-cart-head">
              <h2>Cart</h2>
              <button type="button" className="secondary-btn" onClick={toggleFloatingCart}>
                Close
              </button>
            </div>
            <Cart
              items={cartItems}
              total={totalPrice}
              onRemove={removeFromCart}
              onCheckout={openCheckoutModal}
              isSavingOrder={isSavingOrder}
              error={checkoutError}
              estimatedPrepMinutes={estimatedPrepMinutes}
            />
          </div>
        </div>
      ) : null}

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

      {isReviewModalOpen && reviewingItem ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card review-modal">
            <h2>Write a Review</h2>
            <p className="muted-text">Share your experience with {reviewingItem.name}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitReview();
              }}
              className="review-form"
            >
              <label htmlFor="review-name">Name (optional)</label>
              <input
                id="review-name"
                type="text"
                value={newReview.name}
                onChange={(e) => onReviewFieldChange("name", e.target.value)}
                placeholder="Your name"
              />

              <label>Rating</label>
              <div className="rating-input">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${star <= newReview.rating ? "active" : ""}`}
                    onClick={() => onReviewFieldChange("rating", star)}
                    aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                  >
                    ★
                  </button>
                ))}
                <span className="rating-text">{newReview.rating} star{newReview.rating !== 1 ? "s" : ""}</span>
              </div>

              <label htmlFor="review-comment">Your Review</label>
              <textarea
                id="review-comment"
                value={newReview.comment}
                onChange={(e) => onReviewFieldChange("comment", e.target.value)}
                placeholder="Tell others about your experience..."
                rows={4}
                required
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeReviewModal}
                >
                  Cancel
                </button>
                <button type="submit" disabled={!newReview.comment.trim()}>
                  Submit Review
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



