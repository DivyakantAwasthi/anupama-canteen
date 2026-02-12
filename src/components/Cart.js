function Cart({ items, total, onRemove, onCheckout, isSavingOrder, error }) {
  return (
    <section className="panel cart-panel">
      <h2>Cart</h2>

      {items.length === 0 ? (
        <p className="muted-text">No items selected yet.</p>
      ) : (
        <ul className="cart-list">
          {items.map((item, index) => (
            <li key={`${item.id}-${index}`} className="cart-item">
              <div>
                <span>{item.name}</span>
                <small>Rs. {item.price}</small>
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
        <h3>Total: Rs. {total.toFixed(2)}</h3>
        <button
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
