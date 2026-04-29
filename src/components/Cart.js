function Cart({
  items,
  total,
  onDecrease,
  onIncrease,
  onRemove,
  onCheckout,
  estimatedPrepMinutes,
  isSavingOrder,
  error,
  whatsappLink,
  callLink,
}) {
  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <section className="cart-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your order</p>
          <h2>Cart summary</h2>
        </div>
        <span className="section-meta">
          {totalUnits} item{totalUnits !== 1 ? "s" : ""}
        </span>
      </div>

      {!items.length ? (
        <div className="empty-card">
          <p>Add a few favourites to see your total and checkout options.</p>
        </div>
      ) : (
        <div className="cart-list">
          {items.map((item) => (
            <article className="cart-item" key={item.id}>
              <div className="cart-item-copy">
                <h3>{item.name}</h3>
                <p>
                  Rs. {Number(item.price).toFixed(0)} each
                  {item.badge ? ` • ${item.badge}` : ""}
                </p>
              </div>
              <div className="cart-item-actions">
                <div className="qty-stepper" aria-label={`Quantity for ${item.name}`}>
                  <button type="button" onClick={() => onDecrease(item.id)}>
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => onIncrease(item.id)}>
                    +
                  </button>
                </div>
                <strong>Rs. {(Number(item.price) * Number(item.quantity)).toFixed(0)}</strong>
                <button type="button" className="link-btn" onClick={() => onRemove(item.id)}>
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="cart-summary">
        <div>
          <p className="cart-summary-label">Estimated prep time</p>
          <strong>{estimatedPrepMinutes} mins</strong>
        </div>
        <div className="cart-total">
          <p className="cart-summary-label">To pay</p>
          <strong>Rs. {total.toFixed(2)}</strong>
        </div>
      </div>

      <button
        type="button"
        className="primary-btn checkout-btn"
        onClick={onCheckout}
        disabled={!items.length || isSavingOrder}
      >
        {isSavingOrder ? "Saving your order..." : "Proceed to checkout"}
      </button>

      <div className="support-actions">
        <a href={whatsappLink} target="_blank" rel="noreferrer" className="soft-btn">
          WhatsApp order help
        </a>
        <a href={callLink} className="soft-btn">
          Call now
        </a>
      </div>

      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}

export default Cart;
