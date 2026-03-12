function Cart({
  items,
  total,
  onRemove,
  onCheckout,
  isSavingOrder,
  error,
  estimatedPrepMinutes,
}) {
  const totalUnits = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <section className="panel cart-panel">
      <div className="panel-head">
        <h2>Your Cart</h2>
        <span className="panel-label">
          {items.length} items | {totalUnits} qty
        </span>
      </div>

      {items.length === 0 ? (
        <p className="muted-text">No items selected yet.</p>
      ) : (
        <ul className="cart-list">
          {items.map((item, index) => (
            <li key={`${item.id}-${index}`} className="cart-item">
              <div>
                <span className="cart-item-title">
                  {item.name} {item.quantity ? `x ${item.quantity}` : null}
                </span>
                <small>
                  {item.unitPrice ? `Rs. ${item.unitPrice} each - ` : ""}Rs.{" "}
                  {item.price}
                </small>
              </div>
              <button
                type="button"
                className="remove-btn"
                onClick={() => onRemove(index)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="cart-footer">
        <div>
          <h3>Total: Rs. {total.toFixed(2)}</h3>
          <p className="cart-nudge">
            Estimated prep: {estimatedPrepMinutes || 10} mins after payment
          </p>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          disabled={items.length === 0 || isSavingOrder}
          className="checkout-btn"
        >
          {isSavingOrder ? "Saving..." : "Checkout"}
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}

export default Cart;
