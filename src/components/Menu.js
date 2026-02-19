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
      </div>

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
