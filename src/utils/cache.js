/**
 * @file src/utils/cache.js
 * Cache management utilities
 * Handles local storage operations and data caching
 */

import { CACHE_CONSTANTS } from "../constants";

/**
 * Check if localStorage is available
 * @returns {boolean} True if localStorage is available
 */
export const isLocalStorageAvailable = () => {
  try {
    const test = "__localStorage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get cached data from localStorage
 * @param {string} key - Cache key
 * @returns {any} Cached data or null if not found/expired
 */
export const getCachedData = (key) => {
  if (!isLocalStorageAvailable()) return null;

  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired
    if (parsed.expiry && now > parsed.expiry) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.warn(`Cache read error for key "${key}":`, error);
    localStorage.removeItem(key); // Remove corrupted data
    return null;
  }
};

/**
 * Set cached data in localStorage
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttlMinutes - Time to live in minutes (optional)
 */
export const setCachedData = (key, data, ttlMinutes = null) => {
  if (!isLocalStorageAvailable()) return;

  try {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
    };

    if (ttlMinutes && ttlMinutes > 0) {
      cacheEntry.expiry = Date.now() + (ttlMinutes * 60 * 1000);
    }

    localStorage.setItem(key, JSON.stringify(cacheEntry));
  } catch (error) {
    console.warn(`Cache write error for key "${key}":`, error);
  }
};

/**
 * Remove cached data
 * @param {string} key - Cache key to remove
 */
export const removeCachedData = (key) => {
  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Cache remove error for key "${key}":`, error);
  }
};

/**
 * Clear all cached data with specific prefix
 * @param {string} prefix - Cache key prefix to clear
 */
export const clearCachedData = (prefix = "") => {
  if (!isLocalStorageAvailable()) return;

  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn(`Cache clear error for prefix "${prefix}":`, error);
  }
};

/**
 * Get cache metadata (timestamp, expiry)
 * @param {string} key - Cache key
 * @returns {Object} Cache metadata or null
 */
export const getCacheMetadata = (key) => {
  if (!isLocalStorageAvailable()) return null;

  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    return {
      timestamp: parsed.timestamp,
      expiry: parsed.expiry || null,
      isExpired: parsed.expiry ? Date.now() > parsed.expiry : false,
    };
  } catch {
    return null;
  }
};

/**
 * Get or set cached data with automatic refresh
 * @param {string} key - Cache key
 * @param {Function} fetcher - Function to fetch fresh data
 * @param {number} ttlMinutes - Cache TTL in minutes
 * @returns {Promise<any>} Cached or fresh data
 */
export const getOrSetCachedData = async (key, fetcher, ttlMinutes = CACHE_CONSTANTS.DEFAULT_TTL_MINUTES) => {
  let data = getCachedData(key);

  if (data !== null) {
    return data;
  }

  try {
    data = await fetcher();
    setCachedData(key, data, ttlMinutes);
    return data;
  } catch (error) {
    console.warn(`Failed to fetch and cache data for key "${key}":`, error);
    throw error;
  }
};

/**
 * Cache menu data specifically
 * @param {Array} menuData - Menu data to cache
 */
export const cacheMenuData = (menuData) => {
  setCachedData(CACHE_CONSTANTS.MENU_DATA, menuData, CACHE_CONSTANTS.MENU_TTL_MINUTES);
};

/**
 * Get cached menu data
 * @returns {Array|null} Cached menu data or null
 */
export const getCachedMenuData = () => {
  return getCachedData(CACHE_CONSTANTS.MENU_DATA);
};

/**
 * Cache reviews data
 * @param {Object} reviewsData - Reviews data to cache
 */
export const cacheReviewsData = (reviewsData) => {
  setCachedData(CACHE_CONSTANTS.REVIEWS_DATA, reviewsData, CACHE_CONSTANTS.REVIEWS_TTL_MINUTES);
};

/**
 * Get cached reviews data
 * @returns {Object|null} Cached reviews data or null
 */
export const getCachedReviewsData = () => {
  return getCachedData(CACHE_CONSTANTS.REVIEWS_DATA);
};

/**
 * Cache user preferences
 * @param {Object} preferences - User preferences to cache
 */
export const cacheUserPreferences = (preferences) => {
  setCachedData(CACHE_CONSTANTS.USER_PREFERENCES, preferences, CACHE_CONSTANTS.PREFERENCES_TTL_MINUTES);
};

/**
 * Get cached user preferences
 * @returns {Object|null} Cached user preferences or null
 */
export const getCachedUserPreferences = () => {
  return getCachedData(CACHE_CONSTANTS.USER_PREFERENCES);
};

/**
 * Clear all application cache
 */
export const clearAllCache = () => {
  clearCachedData(CACHE_CONSTANTS.PREFIX);
};

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export const getCacheStats = () => {
  if (!isLocalStorageAvailable()) {
    return { available: false, totalKeys: 0, appKeys: 0 };
  }

  try {
    const totalKeys = localStorage.length;
    let appKeys = 0;
    let expiredKeys = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_CONSTANTS.PREFIX)) {
        appKeys++;
        const metadata = getCacheMetadata(key);
        if (metadata?.isExpired) {
          expiredKeys++;
        }
      }
    }

    return {
      available: true,
      totalKeys,
      appKeys,
      expiredKeys,
      activeKeys: appKeys - expiredKeys,
    };
  } catch {
    return { available: false, totalKeys: 0, appKeys: 0 };
  }
};

/**
 * Clean up expired cache entries
 */
export const cleanupExpiredCache = () => {
  if (!isLocalStorageAvailable()) return;

  try {
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_CONSTANTS.PREFIX)) {
        const metadata = getCacheMetadata(key);
        if (metadata?.isExpired) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    if (keysToRemove.length > 0) {
      console.log(`Cleaned up ${keysToRemove.length} expired cache entries`);
    }
  } catch (error) {
    console.warn("Cache cleanup error:", error);
  }
};
