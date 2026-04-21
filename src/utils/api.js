/**
 * @file src/utils/api.js
 * API utilities and error handling
 * Manages API calls, retries, and error handling
 */

import { API_CONSTANTS } from "../constants";

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Fetch with timeout
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
export const fetchWithTimeout = async (url, options = {}, timeout = API_CONSTANTS.TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new ApiError(`Request timeout after ${timeout}ms`, 408);
    }
    throw error;
  }
};

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} Result of the function
 */
export const retryWithBackoff = async (fn, maxRetries = API_CONSTANTS.MAX_RETRIES, baseDelay = API_CONSTANTS.RETRY_DELAY) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      // Don't retry on client errors (4xx)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000; // Add jitter
      console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Handle API response and throw appropriate errors
 * @param {Response} response - Fetch response
 * @returns {Promise<Object>} Parsed response data
 */
export const handleApiResponse = async (response) => {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorData = null;

    try {
      const errorResponse = await response.json();
      errorMessage = errorResponse.message || errorResponse.error || errorMessage;
      errorData = errorResponse;
    } catch {
      // If response is not JSON, use default error message
    }

    throw new ApiError(errorMessage, response.status, errorData);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ApiError("Invalid JSON response", 500, { originalError: error.message });
  }
};

/**
 * Make API call with retry and error handling
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @param {Object} config - API config (timeout, retries, etc.)
 * @returns {Promise<Object>} API response data
 */
export const apiCall = async (url, options = {}, config = {}) => {
  const {
    timeout = API_CONSTANTS.TIMEOUT,
    maxRetries = API_CONSTANTS.MAX_RETRIES,
    retryDelay = API_CONSTANTS.RETRY_DELAY,
  } = config;

  return retryWithBackoff(async () => {
    const response = await fetchWithTimeout(url, options, timeout);
    return handleApiResponse(response);
  }, maxRetries, retryDelay);
};

/**
 * GET request wrapper
 * @param {string} url - API endpoint URL
 * @param {Object} config - API config
 * @returns {Promise<Object>} API response data
 */
export const apiGet = (url, config = {}) => {
  return apiCall(url, { method: "GET" }, config);
};

/**
 * POST request wrapper
 * @param {string} url - API endpoint URL
 * @param {Object} data - Request body data
 * @param {Object} config - API config
 * @returns {Promise<Object>} API response data
 */
export const apiPost = (url, data, config = {}) => {
  return apiCall(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }, config);
};

/**
 * PUT request wrapper
 * @param {string} url - API endpoint URL
 * @param {Object} data - Request body data
 * @param {Object} config - API config
 * @returns {Promise<Object>} API response data
 */
export const apiPut = (url, data, config = {}) => {
  return apiCall(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }, config);
};

/**
 * DELETE request wrapper
 * @param {string} url - API endpoint URL
 * @param {Object} config - API config
 * @returns {Promise<Object>} API response data
 */
export const apiDelete = (url, config = {}) => {
  return apiCall(url, { method: "DELETE" }, config);
};

/**
 * Check if error is network related
 * @param {Error} error - Error to check
 * @returns {boolean} True if network error
 */
export const isNetworkError = (error) => {
  return error instanceof TypeError && error.message.includes("fetch");
};

/**
 * Check if error is timeout related
 * @param {Error} error - Error to check
 * @returns {boolean} True if timeout error
 */
export const isTimeoutError = (error) => {
  return error instanceof ApiError && error.status === 408;
};

/**
 * Check if error is server error (5xx)
 * @param {Error} error - Error to check
 * @returns {boolean} True if server error
 */
export const isServerError = (error) => {
  return error instanceof ApiError && error.status >= 500;
};

/**
 * Check if error is client error (4xx)
 * @param {Error} error - Error to check
 * @returns {boolean} True if client error
 */
export const isClientError = (error) => {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
};

/**
 * Get user-friendly error message
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error) => {
  if (isNetworkError(error)) {
    return "Network connection error. Please check your internet connection.";
  }

  if (isTimeoutError(error)) {
    return "Request timed out. Please try again.";
  }

  if (isServerError(error)) {
    return "Server error. Please try again later.";
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
};

/**
 * Log API error for debugging
 * @param {Error} error - Error to log
 * @param {string} context - Context where error occurred
 */
export const logApiError = (error, context = "") => {
  const logData = {
    message: error.message,
    context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  };

  if (error instanceof ApiError) {
    logData.status = error.status;
    logData.data = error.data;
  }

  console.error("API Error:", logData);

  // In production, you might want to send this to an error reporting service
  // Example: errorReportingService.log(logData);
};

/**
 * Create API endpoint URL
 * @param {string} baseUrl - Base API URL
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {string} Full API URL
 */
export const createApiUrl = (baseUrl, endpoint, params = {}) => {
  const url = new URL(endpoint, baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });

  return url.toString();
};

/**
 * Validate API configuration
 * @param {Object} config - API configuration
 * @returns {boolean} True if config is valid
 */
export const validateApiConfig = (config) => {
  if (!config || typeof config !== "object") return false;

  const required = ["baseUrl"];
  return required.every(key => typeof config[key] === "string" && config[key].trim().length > 0);
};
