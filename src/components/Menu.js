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
}) {
  const [quantities, setQuantities] = useState({});
  const getSelectedQty = (id) => quantities[id] || 1;

  if (isLoading) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h2>Snack Menu</h2>
        </div>
        <p className="muted-text">Loading menu...</p>
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
        <div className="insight-panel">
          <div className="insight-head">
            <h3>Most Ordered Today</h3>
            <span className="insight-note">Live social proof</span>
          </div>
          <div className="top-ordered-list">
            {mostOrderedToday.map((entry) => (
              <div className="top-ordered-chip" key={entry.item.id}>
                <strong>{entry.item.name}</strong>
                <span>{entry.count} sold</span>
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
                  {bundle.count ? ` | Ordered together ${bundle.count} times today` : " | Suggested combo"}
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
          {snacks.map((snack) => (
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
                <h3>{snack.name}</h3>
                <div className="menu-meta-row">
                  <span className="price-badge">Rs. {snack.price}</span>
                  <span className="food-category">{snack.category}</span>
                </div>
                <div className="menu-actions">
                  <div className="qty-group">
                    <label htmlFor={`qty-${snack.id}`}>Qty</label>
                    <select
                      id={`qty-${snack.id}`}
                      value={getSelectedQty(snack.id)}
                      onChange={(event) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [snack.id]: Number(event.target.value),
                        }))
                      }
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                    </select>
                  </div>
                  <button
                    type="button"
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
                    Add
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default Menu;
