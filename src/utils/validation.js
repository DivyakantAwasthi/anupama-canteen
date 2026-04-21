/**
 * @file src/utils/validation.js
 * Data validation and normalization utilities
 * Ensures data integrity and provides safe defaults
 */

/**
 * Validate and normalize menu item data
 * @param {Object} item - Raw menu item data
 * @returns {Object} Validated and normalized item
 */
export const validateMenuItem = (item) => {
  if (!item || typeof item !== "object") {
    return null;
  }

  return {
    id: String(item.id || "").trim() || null,
    name: String(item.name || "").trim() || "Unknown Item",
    description: String(item.description || "").trim() || "",
    price: Math.max(0, Number(item.price || 0)),
    category: String(item.category || "").trim() || "Other",
    image: String(item.image || "").trim() || "",
    available: Boolean(item.available !== false), // Default to true
    rating: Math.max(0, Math.min(5, Number(item.rating || 0))),
    reviewCount: Math.max(0, Number(item.reviewCount || 0)),
    isVeg: Boolean(item.isVeg !== false), // Default to true
    isPopular: Boolean(item.isPopular),
    tags: Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === "string").map(tag => tag.trim()) : [],
  };
};

/**
 * Validate and normalize review data
 * @param {Object} review - Raw review data
 * @returns {Object} Validated and normalized review
 */
export const validateReview = (review) => {
  if (!review || typeof review !== "object") {
    return null;
  }

  return {
    id: String(review.id || "").trim() || null,
    name: String(review.name || "").trim() || "Anonymous",
    rating: Math.max(1, Math.min(5, Number(review.rating || 0))),
    comment: String(review.comment || "").trim() || "",
    date: review.date ? new Date(review.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    helpfulCount: Math.max(0, Number(review.helpfulCount || 0)),
  };
};

/**
 * Validate and normalize order data
 * @param {Object} order - Raw order data
 * @returns {Object} Validated and normalized order
 */
export const validateOrder = (order) => {
  if (!order || typeof order !== "object") {
    return null;
  }

  return {
    id: String(order.id || "").trim() || null,
    items: Array.isArray(order.items) ? order.items.map(validateOrderItem).filter(Boolean) : [],
    total: Math.max(0, Number(order.total || 0)),
    customerName: String(order.customerName || "").trim() || "",
    customerPhone: String(order.customerPhone || "").trim() || "",
    customerEmail: String(order.customerEmail || "").trim() || "",
    status: ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"].includes(order.status)
      ? order.status
      : "pending",
    orderTime: order.orderTime ? new Date(order.orderTime).toISOString() : new Date().toISOString(),
    estimatedTime: order.estimatedTime ? String(order.estimatedTime).trim() : "15-20 mins",
    paymentMethod: String(order.paymentMethod || "").trim() || "Cash",
    specialInstructions: String(order.specialInstructions || "").trim() || "",
  };
};

/**
 * Validate and normalize order item data
 * @param {Object} item - Raw order item data
 * @returns {Object} Validated and normalized order item
 */
export const validateOrderItem = (item) => {
  if (!item || typeof item !== "object") {
    return null;
  }

  return {
    id: String(item.id || "").trim() || null,
    name: String(item.name || "").trim() || "Unknown Item",
    price: Math.max(0, Number(item.price || 0)),
    quantity: Math.max(1, Number(item.quantity || 1)),
    specialInstructions: String(item.specialInstructions || "").trim() || "",
  };
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone number
 */
export const isValidPhoneNumber = (phone) => {
  const cleanPhone = String(phone || "").replace(/\s+/g, "");
  const phoneRegex = /^(\+91|91|0)?[6-9]\d{9}$/;
  return phoneRegex.test(cleanPhone);
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email || "").trim());
};

/**
 * Validate customer name
 * @param {string} name - Name to validate
 * @returns {boolean} True if valid name
 */
export const isValidName = (name) => {
  const cleanName = String(name || "").trim();
  return cleanName.length >= 2 && cleanName.length <= 50 && /^[a-zA-Z\s]+$/.test(cleanName);
};

/**
 * Sanitize string input (remove dangerous characters)
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeString = (input) => {
  return String(input || "")
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .trim();
};

/**
 * Validate and normalize array data
 * @param {Array} array - Array to validate
 * @param {Function} validator - Validator function for each item
 * @returns {Array} Validated array
 */
export const validateArray = (array, validator = null) => {
  if (!Array.isArray(array)) return [];

  if (validator && typeof validator === "function") {
    return array.map(validator).filter(item => item !== null && item !== undefined);
  }

  return array.filter(item => item !== null && item !== undefined);
};

/**
 * Check if object has required properties
 * @param {Object} obj - Object to check
 * @param {Array} requiredProps - Array of required property names
 * @returns {boolean} True if all required properties exist
 */
export const hasRequiredProperties = (obj, requiredProps) => {
  if (!obj || typeof obj !== "object" || !Array.isArray(requiredProps)) {
    return false;
  }

  return requiredProps.every(prop => obj.hasOwnProperty(prop) && obj[prop] !== null && obj[prop] !== undefined);
};

/**
 * Deep clone and validate object
 * @param {Object} obj - Object to clone and validate
 * @returns {Object} Cloned and validated object
 */
export const deepValidateObject = (obj) => {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepValidateObject);
  }

  const validated = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      validated[key] = sanitizeString(value);
    } else if (typeof value === "object") {
      validated[key] = deepValidateObject(value);
    } else {
      validated[key] = value;
    }
  }

  return validated;
};

/**
 * Generate unique ID for orders/reviews
 * @param {string} prefix - ID prefix
 * @returns {string} Unique ID
 */
export const generateUniqueId = (prefix = "id") => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}_${timestamp}_${random}`;
};

/**
 * Validate API response structure
 * @param {Object} response - API response to validate
 * @param {Array} requiredFields - Required fields in response
 * @returns {boolean} True if response is valid
 */
export const isValidApiResponse = (response, requiredFields = []) => {
  if (!response || typeof response !== "object") {
    return false;
  }

  if (requiredFields.length === 0) {
    return true;
  }

  return hasRequiredProperties(response, requiredFields);
};
