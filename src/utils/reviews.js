/**
 * @file src/utils/reviews.js
 * Review-related utility functions
 * Centralizes all review logic and calculations
 */

import { REVIEW_CONSTANTS } from "../constants";

/**
 * Get review date timestamp value
 * @param {string|number|Date} value - Date value
 * @returns {number} Timestamp or 0 if invalid
 */
export const getReviewDateValue = (value) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

/**
 * Get helpful count from review
 * @param {Object} review - Review object
 * @returns {number} Helpful count
 */
export const getHelpfulCount = (review) => Math.max(0, Number(review?.helpfulCount || 0));

/**
 * Calculate review top score for sorting
 * @param {Object} review - Review object
 * @returns {number} Top score
 */
export const getReviewTopScore = (review) => {
  const dateValue = getReviewDateValue(review?.date);
  const ageDays = dateValue ? Math.max(0, Math.floor((Date.now() - dateValue) / 86400000)) : 0;
  const recencyBonus = Math.max(0, REVIEW_CONSTANTS.RECENCY_BONUS_DAYS - ageDays);

  return Number(review?.rating || 0) * 20 +
         getHelpfulCount(review) * 1.5 +
         recencyBonus;
};

/**
 * Generate avatar initials from name
 * @param {string} name - Name to generate initials from
 * @returns {string} Initials (max 2 characters)
 */
export const getAvatarInitials = (name) => {
  const safeName = (name || "Anonymous").trim();
  const parts = safeName.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
  return initials || "AN";
};

/**
 * Get avatar tone class based on name hash
 * @param {string} name - Name to generate tone from
 * @returns {string} Tone class name
 */
export const getAvatarToneClass = (name) => {
  const palette = REVIEW_CONSTANTS.REVIEW_AVATAR_TONES;
  const safeName = (name || "Anonymous").trim();
  const hash = safeName.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
};

/**
 * Format review date to readable string
 * @param {string|number|Date} value - Date to format
 * @returns {string} Formatted date
 */
export const formatReviewDate = (value) => {
  const dateValue = getReviewDateValue(value);
  if (!dateValue) return "Recent";

  const daysAgo = Math.floor((Date.now() - dateValue) / 86400000);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return `${daysAgo}d ago`;

  return new Date(dateValue).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

/**
 * Sort reviews by specified criteria
 * @param {Array} reviews - Reviews to sort
 * @param {string} sortBy - Sort criteria ("top", "helpful", "newest")
 * @returns {Array} Sorted reviews
 */
export const sortReviews = (reviews, sortBy = "top") => {
  if (!Array.isArray(reviews)) return [];

  const sorted = [...reviews];

  switch (sortBy) {
    case "helpful":
      return sorted.sort((a, b) => getHelpfulCount(b) - getHelpfulCount(a));

    case "newest":
      return sorted.sort((a, b) => getReviewDateValue(b.date) - getReviewDateValue(a.date));

    case "top":
    default:
      return sorted.sort((a, b) => getReviewTopScore(b) - getReviewTopScore(a));
  }
};

/**
 * Calculate average rating from reviews
 * @param {Array} reviews - Reviews array
 * @returns {number} Average rating (0-5)
 */
export const calculateAverageRating = (reviews) => {
  if (!Array.isArray(reviews) || reviews.length === 0) return 0;

  const totalRating = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return Math.round((totalRating / reviews.length) * 10) / 10;
};

/**
 * Get rating distribution from reviews
 * @param {Array} reviews - Reviews array
 * @returns {Object} Rating distribution {1: count, 2: count, ...}
 */
export const getRatingDistribution = (reviews) => {
  if (!Array.isArray(reviews)) return {};

  return reviews.reduce((dist, review) => {
    const rating = Math.floor(Number(review.rating || 0));
    if (rating >= 1 && rating <= 5) {
      dist[rating] = (dist[rating] || 0) + 1;
    }
    return dist;
  }, {});
};

/**
 * Generate demo reviews for an item (for development/testing)
 * @param {string} itemName - Name of the item
 * @returns {Array} Array of demo reviews
 */
export const generateDemoReviews = (itemName) => {
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
    date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    helpfulCount: Math.max(0, Math.floor(Math.random() * 35) + (template.rating >= 4 ? 8 : 2)),
  }));
};

/**
 * Get ratings data from reviews by item
 * @param {Array} items - Menu items
 * @param {Object} reviewsByItem - Reviews grouped by item ID
 * @returns {Object} Ratings data by item ID
 */
export const getRatingsFromReviews = (items, reviewsByItem) => {
  const ratings = {};

  items.forEach((item) => {
    const itemReviews = Array.isArray(reviewsByItem?.[item.id]) ? reviewsByItem[item.id] : [];
    if (!itemReviews.length) {
      ratings[item.id] = { rating: 0, reviewCount: 0 };
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
