const FALLBACK_IMAGE = "/menu-placeholder.svg";

function Menu({
  snacks,
  quantities,
  onAddToCart,
  onDecreaseQuantity,
  isLoading,
  error,
  onRetry,
}) {
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
        {snacks.map((snack) => {
          const quantity = quantities[snack.id] || 0;

          return (
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

                {quantity > 0 ? (
                  <div className="quantity-control" aria-label={`${snack.name} quantity`}>
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => onDecreaseQuantity(snack.id)}
                    >
                      -
                    </button>
                    <span className="qty-value">{quantity}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => onAddToCart(snack)}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => onAddToCart(snack)}>
                    Add to Cart
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default Menu;
