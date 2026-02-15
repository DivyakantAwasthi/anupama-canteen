import { QRCodeCanvas } from "qrcode.react";

function Confirmation({ order, onConfirmPayment, onNewOrder }) {
  const upiId = process.env.REACT_APP_UPI_ID || "9807980222@ptsbi";
  const payeeName = process.env.REACT_APP_UPI_PAYEE_NAME || "Utkarsh Shukla";

  const amount = (order?.total || 0).toFixed(2);
  const orderRef = String(order?.orderId || "");
  const note = orderRef ? `Order ${orderRef}` : "Snack order";

  // Include tr/tid/tn so UPI apps can prefill order reference and note.
  const upiLink = `upi://pay?pa=${encodeURIComponent(
    upiId
  )}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(
    amount
  )}&cu=INR&tr=${encodeURIComponent(orderRef)}&tid=${encodeURIComponent(
    orderRef
  )}&tn=${encodeURIComponent(note)}`;

  const isMobileDevice =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  if (!order) return null;

  return (
    <section className="panel confirmation-panel">
      {order.paid ? (
        <>
          <h2>Payment Received</h2>
          <p>Your payment was received and the order is confirmed.</p>
          <p>
            <strong>Order ID:</strong> {order.orderId}
          </p>
          <p>
            <strong>Total:</strong> Rs. {amount}
          </p>

          {order.notificationError ? (
            <p className="error-text">{order.notificationError}</p>
          ) : (
            <p className="muted-text">
              Notification request sent for user/admin.
            </p>
          )}

          <button type="button" onClick={onNewOrder}>
            Place New Order
          </button>
        </>
      ) : (
        <>
          <h2>Awaiting Payment</h2>
          <p>Please scan the QR code below to pay for your order.</p>

          <p>
            <strong>Order ID:</strong> {order.orderId}
          </p>
          <p>
            <strong>Total:</strong> Rs. {amount}
          </p>

          <div className="qr-wrap">
            <QRCodeCanvas value={upiLink} size={220} includeMargin />
          </div>
          <p className="muted-text">Scan to pay via UPI (Order ref: {orderRef})</p>
          <p className="muted-text">
            <strong>UPI ID:</strong> {upiId}
          </p>

          {isMobileDevice ? (
            <a href={upiLink} className="upi-app-btn">
              Pay with UPI App
            </a>
          ) : (
            <p className="muted-text upi-mobile-hint">
              Open this page on your phone to pay directly in any UPI app.
            </p>
          )}

          {order.error ? <p className="error-text">{order.error}</p> : null}

          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              justifyContent: "center",
            }}
          >
            <button type="button" onClick={onConfirmPayment} disabled={order.saving}>
              {order.saving ? "Confirming..." : "I have paid (confirm)"}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={onNewOrder}
              disabled={order.saving}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default Confirmation;