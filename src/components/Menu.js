import { useState } from "react";

const FALLBACK_IMAGE = "/menu-placeholder.svg";

function Menu({ snacks, onAddToCart, isLoading, error, onRetry }) {
  const [quantities, setQuantities] = useState({});
  if (isLoading) {
    return (
      <section className="panel">
        <h2>Snack Menu</h2>
        <p className="muted-text">Loading menu...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <h2>Snack Menu</h2>
        <p className="error-text">{error}</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </section>
    );
  }

  if (!snacks.length) {
    return (
      <section className="panel">
        <h2>Snack Menu</h2>
        <p className="muted-text">No snacks are available right now.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Snack Menu</h2>
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
              <p>Rs. {snack.price}</p>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <label style={{ fontSize: "0.9rem" }}>
                  Qty:
                  <select
                    value={quantities[snack.id] || 1}
                    onChange={(e) =>
                      setQuantities((prev) => ({ ...prev, [snack.id]: Number(e.target.value) }))
                    }
                    style={{ marginLeft: 6 }}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                  </select>
                </label>
                <button
                  onClick={() => {
                    const qty = quantities[snack.id] || 1;
                    onAddToCart({
                      ...snack,
                      quantity: qty,
                      unitPrice: snack.price,
                      price: Number(snack.price) * qty,
                    });
                  }}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Menu;
