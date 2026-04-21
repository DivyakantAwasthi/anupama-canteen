import { useState } from "react";

const FALLBACK_IMAGE = "/menu-placeholder.svg";
const STAR_FILLED = "\u2605";
const STAR_EMPTY = "\u2606";
const REVIEW_SORT_OPTIONS = [
  { value: "top", label: "Top rated" },
  { value: "helpful", label: "Most helpful" },
  { value: "newest", label: "Newest first" },
];

const getReviewDateValue = (value) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getHelpfulCount = (review) => Math.max(0, Number(review?.helpfulCount || 0));

const getReviewTopScore = (review) => {
  const dateValue = getReviewDateValue(review?.date);
  const ageDays = dateValue ? Math.max(0, Math.floor((Date.now() - dateValue) / 86400000)) : 0;
  const recencyBonus = Math.max(0, 30 - ageDays);
  return Number(review?.rating || 0) * 20 + getHelpfulCount(review) * 1.5 + recencyBonus;
};

const getAvatarInitials = (name) => {
  const safeName = (name || "Anonymous").trim();
  const parts = safeName.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
  return initials || "AN";
};

const getAvatarToneClass = (name) => {
  const palette = ["tone-a", "tone-b", "tone-c", "tone-d"];
  const safeName = (name || "Anonymous").trim();
  const hash = safeName.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
};

const formatReviewDate = (value) => {
  const dateValue = getReviewDateValue(value);
  if (!dateValue) {
    return "Recent";
  }

  const daysAgo = Math.floor((Date.now() - dateValue) / 86400000);
  if (daysAgo <= 0) {
    return "Today";
  }
  if (daysAgo === 1) {
    return "Yesterday";
  }
  if (daysAgo < 7) {
    return `${daysAgo}d ago`;
  }

  return new Date(dateValue).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

function Menu({
  snacks,
  totalSnackCount,
  searchQuery,
  onSearchChange,
  categories,
  activeCategory,
  onCategoryChange,
  onClearFilters,
  onAddToCart,
  isLoading,
  error,
  onRetry,
  quickPickIds,
  mostOrderedToday,
  frequentlyBoughtTogether,
  onAddBundle,
  itemRatings,
  reviews,
  onOpenReviewModal,
}) {
  const [quantities, setQuantities] = useState({});
  const [expandedReviews, setExpandedReviews] = useState({});
  const [reviewSortBy, setReviewSortBy] = useState({});

  const getSelectedQty = (id) => quantities[id] || 1;

  if (isLoading) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h2>Snack Menu</h2>
        </div>
        <div className="menu-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="menu-card skeleton" key={index}>
              <div className="skeleton-image"></div>
              <div className="menu-card-body">
                <div className="skeleton-title"></div>
                <div className="skeleton-text"></div>
                <div className="skeleton-price"></div>
                <div className="skeleton-button"></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h2>Snack Menu</h2>
        </div>
        <p className="error-text">{error}</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Snack Menu</h2>
        <span className="panel-label">
          Showing {snacks.length} of {totalSnackCount}
        </span>
      </div>

      <div className="menu-toolbar">
        <label htmlFor="menu-search" className="sr-only">
          Search menu
        </label>
        <input
          id="menu-search"
          className="search-input"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search snacks, drinks, meals..."
        />
        <div className="category-tabs" role="tablist" aria-label="Menu categories">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={category === activeCategory}
              className={`category-tab ${category === activeCategory ? "active" : ""}`}
              onClick={() => onCategoryChange(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <p className="menu-tip">Tip: choose a Quick Pick for faster decisions.</p>
      </div>

      {mostOrderedToday?.length ? (
        <div className="popular-section">
          <div className="popular-header">
            <h3>Popular Items</h3>
            <span className="popular-note">Most loved by customers</span>
          </div>
          <div className="popular-grid">
            {mostOrderedToday.slice(0, 6).map((entry) => (
              <div className="popular-item" key={entry.item.id}>
                <img
                  src={entry.item.image || FALLBACK_IMAGE}
                  alt={entry.item.name}
                  className="popular-image"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />
                <div className="popular-content">
                  <h4>{entry.item.name}</h4>
                  <div className="popular-meta">
                    <span className="popular-price">Rs. {entry.item.price}</span>
                    <span className="popular-orders">{entry.count} ordered today</span>
                  </div>
                  <button
                    type="button"
                    className="popular-add-btn"
                    onClick={() => {
                      onAddToCart({
                        ...entry.item,
                        quantity: 1,
                        unitPrice: Number(entry.item.price),
                        price: Number(entry.item.price),
                      });
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {frequentlyBoughtTogether?.length ? (
        <div className="insight-panel">
          <div className="insight-head">
            <h3>Frequently Bought Together</h3>
            <span className="insight-note">Save ordering time</span>
          </div>
          <div className="bundle-grid">
            {frequentlyBoughtTogether.map((bundle) => (
              <article className="bundle-card" key={bundle.id}>
                <p className="bundle-title">
                  {bundle.left.name} + {bundle.right.name}
                </p>
                <p className="bundle-meta">
                  Rs. {bundle.totalPrice.toFixed(2)}
                  {bundle.count
                    ? ` | Ordered together ${bundle.count} times today`
                    : " | Suggested combo"}
                </p>
                <button type="button" onClick={() => onAddBundle(bundle)}>
                  Add Bundle
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {!snacks.length ? (
        <div className="empty-state">
          <p className="muted-text">No items match your filters.</p>
          <button type="button" className="secondary-btn" onClick={onClearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="menu-grid">
          {snacks.map((snack) => {
            const itemReviews = reviews[snack.id] || [];
            const reviewsOpen = Boolean(expandedReviews[snack.id]);
            const selectedReviewSort = reviewSortBy[snack.id] || "top";
            const topReviewId = [...itemReviews].sort(
              (firstReview, secondReview) =>
                getReviewTopScore(secondReview) - getReviewTopScore(firstReview)
            )[0]?.id;
            const sortedReviews = [...itemReviews].sort((firstReview, secondReview) => {
              if (selectedReviewSort === "helpful") {
                const byHelpful = getHelpfulCount(secondReview) - getHelpfulCount(firstReview);
                if (byHelpful !== 0) {
                  return byHelpful;
                }
                return Number(secondReview.rating || 0) - Number(firstReview.rating || 0);
              }

              if (selectedReviewSort === "newest") {
                const byDate = getReviewDateValue(secondReview.date) - getReviewDateValue(firstReview.date);
                if (byDate !== 0) {
                  return byDate;
                }
                return Number(secondReview.rating || 0) - Number(firstReview.rating || 0);
              }

              const byRating = Number(secondReview.rating || 0) - Number(firstReview.rating || 0);
              if (byRating !== 0) {
                return byRating;
              }

              const byHelpful = getHelpfulCount(secondReview) - getHelpfulCount(firstReview);
              if (byHelpful !== 0) {
                return byHelpful;
              }

              return getReviewDateValue(secondReview.date) - getReviewDateValue(firstReview.date);
            });
            const visibleReviews = sortedReviews.slice(0, 4);
            const extraReviewCount = Math.max(0, itemReviews.length - visibleReviews.length);

            return (
              <article className="menu-card" key={snack.id}>
                {quickPickIds?.has(String(snack.id)) ? (
                  <span className="quick-pick-badge">Quick Pick</span>
                ) : null}
                <img
                  src={snack.image || FALLBACK_IMAGE}
                  alt={snack.name}
                  className="menu-image"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />
                <div className="menu-card-body">
                  <div className="menu-header">
                    <h3>{snack.name}</h3>
                    <div className="veg-indicator">
                      <span className="veg-icon">Veg</span>
                    </div>
                  </div>
                  <p className="menu-description">
                    {snack.description || "Fresh and delicious, prepared with the finest ingredients."}
                  </p>
                  <div className="menu-meta-row">
                    <span className="price-badge">Rs. {snack.price}</span>
                    {itemRatings[snack.id] ? (
                      <div className="item-rating">
                        <span className="stars">
                          {STAR_FILLED.repeat(Math.floor(itemRatings[snack.id].rating))}
                          {STAR_EMPTY.repeat(5 - Math.floor(itemRatings[snack.id].rating))}
                        </span>
                        <span className="rating-text">
                          {itemRatings[snack.id].rating} ({itemRatings[snack.id].reviewCount})
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="menu-actions">
                    <div className="qty-selector">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() =>
                          setQuantities((prev) => ({
                            ...prev,
                            [snack.id]: Math.max(1, getSelectedQty(snack.id) - 1),
                          }))
                        }
                      >
                        -
                      </button>
                      <span className="qty-display">{getSelectedQty(snack.id)}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() =>
                          setQuantities((prev) => ({
                            ...prev,
                            [snack.id]: Math.min(10, getSelectedQty(snack.id) + 1),
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="add-to-cart-btn"
                      onClick={() => {
                        const qty = getSelectedQty(snack.id);
                        const unitPrice = Number(snack.price);

                        onAddToCart({
                          ...snack,
                          quantity: qty,
                          unitPrice,
                          price: unitPrice * qty,
                        });
                      }}
                    >
                      <span className="btn-text">Add to Cart</span>
                      <span className="btn-price">Rs. {Number(snack.price) * getSelectedQty(snack.id)}</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className="write-review-btn"
                    onClick={() => onOpenReviewModal(snack)}
                  >
                    Write a Review
                  </button>
                  {itemReviews.length > 0 ? (
                    <button
                      type="button"
                      className={`review-toggle-btn ${reviewsOpen ? "active" : ""}`}
                      onClick={() =>
                        setExpandedReviews((prev) => ({
                          ...prev,
                          [snack.id]: !prev[snack.id],
                        }))
                      }
                      aria-expanded={reviewsOpen}
                    >
                      {reviewsOpen ? "Hide Reviews" : `Reviews (${itemReviews.length})`}
                    </button>
                  ) : null}
                  {itemReviews.length > 0 && reviewsOpen ? (
                    <div className="reviews-section">
                      <div className="review-head-row">
                        <h4>Customer Reviews ({itemReviews.length})</h4>
                        <label className="review-sort-wrap">
                          <span>Sort</span>
                          <select
                            className="review-sort-select"
                            value={selectedReviewSort}
                            onChange={(event) =>
                              setReviewSortBy((prev) => ({
                                ...prev,
                                [snack.id]: event.target.value,
                              }))
                            }
                            aria-label={`Sort reviews for ${snack.name}`}
                          >
                            {REVIEW_SORT_OPTIONS.map((sortOption) => (
                              <option key={sortOption.value} value={sortOption.value}>
                                {sortOption.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="reviews-list">
                        {visibleReviews.map((review) => (
                          <div
                            key={review.id}
                            className={`review-item ${review.id === topReviewId ? "top-review" : ""}`}
                          >
                            <div className="review-header">
                              <div className="review-author-block">
                                <div className={`review-avatar ${getAvatarToneClass(review.name)}`}>
                                  {getAvatarInitials(review.name)}
                                </div>
                                <div className="review-author-meta">
                                  <div className="review-author-row">
                                    <span className="review-author">{review.name || "Anonymous"}</span>
                                    {review.id === topReviewId ? (
                                      <span className="top-review-badge">Top Review</span>
                                    ) : null}
                                  </div>
                                  <div className="review-rating">
                                    <span className="review-stars">
                                      {STAR_FILLED.repeat(Number(review.rating || 0))}
                                      {STAR_EMPTY.repeat(5 - Number(review.rating || 0))}
                                    </span>
                                    <span className="review-date">{formatReviewDate(review.date)}</span>
                                  </div>
                                </div>
                              </div>
                              <span className="review-helpful">{getHelpfulCount(review)} helpful</span>
                            </div>
                            <p className="review-comment">{review.comment}</p>
                          </div>
                        ))}
                        {extraReviewCount > 0 ? (
                          <p className="more-reviews">
                            +{extraReviewCount} more review
                            {extraReviewCount !== 1 ? "s" : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default Menu;
