import { useEffect, useMemo, useState } from "react";
import { sortReviews } from "../utils/reviews";

const FALLBACK_IMAGE = "/menu-placeholder.svg";

function Menu({
  items,
  totalItems,
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
  itemRatings = {},
  reviews = {},
  featuredItemIds,
  popularItemIds,
  onOpenReviewModal,
  onViewItem,
}) {
  const [openReviews, setOpenReviews] = useState({});

  const featuredLookup = useMemo(
    () => new Set((featuredItemIds || []).map((value) => String(value))),
    [featuredItemIds]
  );
  const popularLookup = useMemo(
    () => new Set((popularItemIds || []).map((value) => String(value))),
    [popularItemIds]
  );

  useEffect(() => {
    if (!onViewItem || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const seen = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const itemId = entry.target.getAttribute("data-menu-item-id");
          if (!itemId || seen.has(itemId)) {
            return;
          }

          const item = items.find((candidate) => String(candidate.id) === itemId);
          if (item) {
            seen.add(itemId);
            onViewItem(item);
          }
        });
      },
      { threshold: 0.55 }
    );

    document
      .querySelectorAll("[data-menu-item-id]")
      .forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [items, onViewItem]);

  if (isLoading) {
    return (
      <section className="menu-shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Today&apos;s menu</p>
            <h2>Fresh picks loading</h2>
          </div>
        </div>
        <div className="menu-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="menu-skeleton" key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="menu-shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Today&apos;s menu</p>
            <h2>Menu needs a quick refresh</h2>
          </div>
        </div>
        <div className="status-card">
          <p>{error}</p>
          <button type="button" className="primary-btn" onClick={onRetry}>
            Retry menu
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="menu-shell" id="menu-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Today&apos;s menu</p>
          <h2>Fresh favourites, ready fast.</h2>
        </div>
        <span className="section-meta">{totalItems} items available</span>
      </div>

      <div className="menu-tools">
        <label htmlFor="menu-search" className="sr-only">
          Search menu
        </label>
        <input
          id="menu-search"
          type="search"
          className="menu-search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search pav bhaji, noodles, coffee..."
        />

        <div className="category-row" aria-label="Menu categories">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={`category-chip ${activeCategory === category ? "is-active" : ""}`}
              onClick={() => onCategoryChange(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {!!searchQuery && (
          <button type="button" className="link-btn reset-btn" onClick={onClearFilters}>
            Clear search
          </button>
        )}
      </div>

      {!items.length ? (
        <div className="status-card">
          <p>No items matched your search. Try another keyword or reset the filter.</p>
          <button type="button" className="soft-btn" onClick={onClearFilters}>
            Reset filters
          </button>
        </div>
      ) : (
        <div className="menu-grid">
          {items.map((item, index) => {
            const rating = itemRatings[item.id];
            const itemReviews = sortReviews(reviews[item.id] || [], "top");
            const leadReview = itemReviews[0];
            const isFeatured = featuredLookup.has(String(item.id));
            const isPopular = popularLookup.has(String(item.id));
            const showReviews = !!openReviews[item.id];

            return (
              <article className="menu-card" key={item.id} data-menu-item-id={item.id}>
                <div className="menu-image-wrap">
                  {(isFeatured || isPopular) && (
                    <span className={`card-badge ${isFeatured ? "accent" : "warm"}`}>
                      {isFeatured ? "Most Loved" : "Fast Moving"}
                    </span>
                  )}
                  {index < 2 && <span className="veg-badge">Veg</span>}
                  <img
                    src={item.image || FALLBACK_IMAGE}
                    alt={item.name}
                    className="menu-image"
                    loading={index < 4 ? "eager" : "lazy"}
                    decoding="async"
                    fetchpriority={index < 2 ? "high" : "low"}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = FALLBACK_IMAGE;
                    }}
                  />
                </div>

                <div className="menu-card-body">
                  <div className="menu-card-top">
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                    </div>
                    <strong className="price-pill">Rs. {Number(item.price).toFixed(0)}</strong>
                  </div>

                  <div className="menu-card-meta">
                    <span>{item.category}</span>
                    {rating?.reviewCount ? (
                      <span>
                        {rating.rating.toFixed(1)} / 5 - {rating.reviewCount} reviews
                      </span>
                    ) : (
                      <span>Ready in about 15 mins</span>
                    )}
                  </div>

                  <div className="menu-card-actions">
                    <button
                      type="button"
                      className="primary-btn compact-btn"
                      onClick={() => onAddToCart(item, 1)}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className="soft-btn compact-btn"
                      onClick={() => onAddToCart(item, 2)}
                    >
                      Add 2
                    </button>
                  </div>

                  {leadReview ? (
                    <div className="review-snippet">
                      <p className="review-snippet-title">Customer review</p>
                      <blockquote>&quot;{leadReview.comment}&quot;</blockquote>
                      <p className="review-snippet-meta">
                        {leadReview.name} - {leadReview.rating}/5
                      </p>
                    </div>
                  ) : null}

                  <div className="menu-card-footer">
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() =>
                        setOpenReviews((previous) => ({
                          ...previous,
                          [item.id]: !previous[item.id],
                        }))
                      }
                    >
                      {showReviews ? "Hide reviews" : `View reviews (${itemReviews.length})`}
                    </button>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => onOpenReviewModal(item)}
                    >
                      Write a review
                    </button>
                  </div>

                  {showReviews && itemReviews.length > 0 ? (
                    <div className="review-list">
                      {itemReviews.slice(0, 3).map((review) => (
                        <div className="review-card" key={review.id}>
                          <strong>{review.name}</strong>
                          <span>{review.rating}/5</span>
                          <p>{review.comment}</p>
                        </div>
                      ))}
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
