/**
 * @file src/utils/formatters.js
 * Data formatting utilities for dates, numbers, and text
 * Centralizes all formatting logic used across components
 */

/**
 * Format a date value to a relative time string (e.g., "3d ago")
 * @param {string|number|Date} dateValue - The date to format
 * @returns {string} Formatted relative date
 */
export const formatRelativeDate = (dateValue) => {
  const timestamp = Date.parse(dateValue);
  if (Number.isNaN(timestamp)) {
    return "Recent";
  }

  const daysAgo = Math.floor((Date.now() - timestamp) / 86400000);

  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return `${daysAgo}d ago`;

  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

/**
 * Format a price to INR currency string
 * @param {number} amount - The price amount
 * @returns {string} Formatted price (e.g., "₹50.00")
 */
export const formatPrice = (amount) => {
  return `₹${Number(amount || 0).toFixed(2)}`;
};

/**
 * Format a phone number to a readable format
 * @param {string} phone - Raw phone number
 * @returns {string} Formatted phone
 */
export const formatPhoneNumber = (phone) => {
  const cleaned = String(phone || "").replace(/\D/g, "");
  if (cleaned.length !== 10) return phone;
  return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
};

/**
 * Capitalize first letter of each word in a string
 * @param {string} text - Text to capitalize
 * @returns {string} Title-cased text
 */
export const toTitleCase = (text) => {
  return String(text || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Truncate text to a maximum length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  const trimmed = String(text || "").trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
};

/**
 * Format order items list to readable string
 * @param {Array} items - Array of order items
 * @returns {string} Formatted items string (e.g., "Vada Pav x2, Dosa x1")
 */
export const formatOrderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "No items";
  }

  return items
    .map((item) => {
      const name = item.name || "Unknown";
      const qty = item.qty || 1;
      return qty > 1 ? `${name} x${qty}` : name;
    })
    .join(", ");
};

/**
 * Format item category label with proper casing and aliases
 * @param {string} categoryValue - Raw category value
 * @param {string} itemName - Item name (fallback for pattern matching)
 * @returns {string} Formatted category label
 */
export const formatCategoryLabel = (categoryValue, itemName = "") => {
  const raw = String(categoryValue || "").trim();
  if (raw) {
    return toTitleCase(raw);
  }

  const lowerName = String(itemName || "").toLowerCase();

  // Match category patterns
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

  return "Popular";
};

/**
 * Format order date to a readable string
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export const getTodayDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Format milliseconds to a readable time duration
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "2.5s", "1m 30s")
 */
export const formatDuration = (ms) => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};
