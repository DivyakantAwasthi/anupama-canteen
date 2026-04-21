/**
 * @file src/constants/index.js
 * Centralized application constants
 * This file contains all hardcoded values, timeouts, cache keys, and configuration
 */

// ============================================================================
// API CONFIGURATION
// ============================================================================

export const API_ENDPOINTS = {
  MENU: process.env.REACT_APP_MENU_API_URL || "/api/menu",
  ORDERS: process.env.REACT_APP_ORDERS_API_URL,
  REVIEWS: process.env.REACT_APP_REVIEWS_ENDPOINT || "/api/reviews",
  APPEND_ORDER: process.env.REACT_APP_APPEND_ORDER_ENDPOINT || "/append-order",
  WHATSAPP_NOTIFY: process.env.REACT_APP_WHATSAPP_NOTIFY_ENDPOINT || "/api/whatsapp-notify",
  HEALTH: "/api/health",
};

export const API_TIMEOUTS = {
  REQUEST: 8000, // milliseconds
  MENU_FETCH: 8000,
  REVIEW_FETCH: 5000,
};

export const API_RETRY = {
  MAX_ATTEMPTS: 2,
  INITIAL_DELAY: 500, // milliseconds
  BACKOFF_MULTIPLIER: 2,
};

// ============================================================================
// API CONSTANTS (for utils/api.js)
// ============================================================================

export const API_CONSTANTS = {
  TIMEOUT: 8000, // milliseconds
  MAX_RETRIES: 2,
  RETRY_DELAY: 500, // milliseconds
};

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

export const CACHE_KEYS = {
  MENU: "anupama:menu:cache:v1",
  ORDERS: "anupama:orders:",
  ORDER_COUNTER: "anupama:orderCounter:",
  WHATSAPP_SENT: "anupama:whatsappSent:",
};

export const CACHE_DURATION = {
  MENU: 30000, // milliseconds (30 seconds for silent refresh)
};

// ============================================================================
// CACHE CONSTANTS (for utils/cache.js)
// ============================================================================

export const CACHE_CONSTANTS = {
  PREFIX: "anupama:",
  MENU_DATA: "anupama:menu:data:v1",
  REVIEWS_DATA: "anupama:reviews:data:v1",
  USER_PREFERENCES: "anupama:user:preferences:v1",
  DEFAULT_TTL_MINUTES: 30,
  MENU_TTL_MINUTES: 30,
  REVIEWS_TTL_MINUTES: 15,
  PREFERENCES_TTL_MINUTES: 1440, // 24 hours
};

// ============================================================================
// ORDER STATUS CONSTANTS
// ============================================================================

export const ORDER_STATUS = {
  PENDING_PAYMENT: "pending_payment",
  PAYMENT_VERIFIED: "payment_verified",
  PREPARING: "preparing",
  READY_FOR_PICKUP: "ready_for_pickup",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export const ORDER_STATUS_TEXT = {
  [ORDER_STATUS.PENDING_PAYMENT]: "Awaiting payment",
  [ORDER_STATUS.PAYMENT_VERIFIED]: "Payment verified",
  [ORDER_STATUS.PREPARING]: "Preparing order",
  [ORDER_STATUS.READY_FOR_PICKUP]: "Ready for pickup",
  [ORDER_STATUS.DELIVERED]: "Delivered",
  [ORDER_STATUS.CANCELLED]: "Cancelled",
};

// ============================================================================
// REVIEW CONSTANTS (for utils/reviews.js)
// ============================================================================

export const REVIEW_CONSTANTS = {
  RECENCY_BONUS_DAYS: 30, // Days within which reviews get recency bonus
  REVIEW_AVATAR_TONES: [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-red-500",
    "bg-yellow-500",
    "bg-teal-500",
  ],
  SORT_OPTIONS: {
    TOP: "top",
    HELPFUL: "helpful",
    NEWEST: "newest",
  },
  DEFAULT_SORT: "top",
  MIN_RATING: 1,
  MAX_RATING: 5,
  DEFAULT_RATING: 5,
  MIN_COMMENT_LENGTH: 3,
};

// ============================================================================
// TIME CONSTANTS
// ============================================================================

export const TIME_DELAYS = {
  STATUS_TICK: 1000, // milliseconds (update status every second)
  MENU_REFRESH: 30000, // milliseconds (refresh menu every 30 seconds)
  PREPARING_START: 20000, // milliseconds (when to show "preparing")
  READY_START: 50000, // milliseconds (when to show "ready")
};

// ============================================================================
// UI CONSTANTS
// ============================================================================

export const UI_CONSTANTS = {
  DEFAULT_CATEGORY: "Popular",
  ALL_CATEGORIES: "All",
  SKELETON_ITEMS_COUNT: 6,
  REVIEW_AVATAR_TONES: ["tone-a", "tone-b", "tone-c", "tone-d"],
};

export const MENU_IMAGES = {
  DEFAULT: "/menu-placeholder.svg",
  FALLBACK_CDN: "https://images.unsplash.com/photo-1601050690597-df0568f70950",
};

// ============================================================================
// CATEGORY PATTERNS
// ============================================================================

export const CATEGORY_PATTERNS = {
  BEVERAGES: /(tea|coffee|cold coffee|drink|juice|shake|lassi|coke|campa)/i,
  QUICK_BITES: /(sandwich|vada pav|samosa|roll|burger|cutlet|toast)/i,
  SOUTH_INDIAN: /(idli|dosa|uttapam|poha|upma|paratha)/i,
  MEALS: /(noodle|manchurian|chowmein|rice|fried rice)/i,
};

export const CATEGORY_LABELS = {
  BEVERAGES: "Beverages",
  QUICK_BITES: "Quick Bites",
  SOUTH_INDIAN: "South Indian",
  MEALS: "Meals",
};

// ============================================================================
// PAYMENT CONSTANTS
// ============================================================================

export const PAYMENT_CONSTANTS = {
  UPI_ID: process.env.REACT_APP_UPI_ID || "9807980222@ptsbi",
  UPI_PAYEE_NAME: process.env.REACT_APP_UPI_PAYEE_NAME || "Utkarsh Shukla",
};

// ============================================================================
// ORDER POST ACTIONS
// ============================================================================

export const ORDER_POST_ACTIONS = {
  APPEND: process.env.REACT_APP_ORDER_POST_ACTION || "appendOrder",
  TRACK: process.env.REACT_APP_TRACK_ORDER_ACTION || "trackOrder",
};

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  MENU_LOAD_FAILED: "Unable to load menu. Please try again.",
  API_TIMEOUT: "Request timed out. Please try again.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  MENU_UNAVAILABLE: "Menu is temporarily unavailable. Please try again.",
  ORDER_SUBMISSION_FAILED: "Failed to submit order. Please try again.",
  INVALID_PAYMENT: "Invalid payment details. Please try again.",
};

// ============================================================================
// SUCCESS MESSAGES
// ============================================================================

export const SUCCESS_MESSAGES = {
  ORDER_SUBMITTED: "Order submitted successfully!",
  PAYMENT_VERIFIED: "Payment verified. Your order is being prepared.",
  ORDER_READY: "Your order is ready for pickup!",
  REVIEW_SUBMITTED: "Thank you for your review!",
};

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

export const VALIDATION = {
  PHONE_PATTERN: /^[6-9]\d{9}$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 50,
};
