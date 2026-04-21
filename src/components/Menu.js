import { useState } from "react";

const FALLBACK_IMAGE = "/menu-placeholder.svg";

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
                          {"★".repeat(Math.floor(itemRatings[snack.id].rating))}
                          {"☆".repeat(5 - Math.floor(itemRatings[snack.id].rating))}
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
                      <h4>Customer Reviews ({itemReviews.length})</h4>
                      <div className="reviews-list">
                        {itemReviews.slice(0, 3).map((review) => (
                          <div key={review.id} className="review-item">
                            <div className="review-header">
                              <span className="review-author">{review.name}</span>
                              <div className="review-rating">
                                <span className="review-stars">
                                  {"★".repeat(review.rating)}
                                  {"☆".repeat(5 - review.rating)}
                                </span>
                                <span className="review-date">{review.date}</span>
                              </div>
                            </div>
                            <p className="review-comment">{review.comment}</p>
                          </div>
                        ))}
                        {itemReviews.length > 3 ? (
                          <p className="more-reviews">
                            +{itemReviews.length - 3} more review
                            {itemReviews.length - 3 !== 1 ? "s" : ""}
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
