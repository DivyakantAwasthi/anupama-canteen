import { QRCodeCanvas } from "qrcode.react";

function Confirmation({ order, onConfirmPayment, onNewOrder }) {
  const upiId = process.env.REACT_APP_UPI_ID || "9807980222@ptsbi";
  const payeeName = process.env.REACT_APP_UPI_PAYEE_NAME || "Utkarsh Shukla";

  const amount = (order?.total || 0).toFixed(2);
  const note = `Order ${order?.orderId || "-"}`;
  const qrValue = `upi://pay?pa=${encodeURIComponent(
    upiId
  )}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(
    note
  )}`;

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
            <QRCodeCanvas value={qrValue} size={220} includeMargin />
          </div>
          <p className="muted-text">Scan to pay via UPI</p>
          <p className="muted-text">
            <strong>UPI ID:</strong> {upiId}
          </p>

          {order.error ? (
            <p className="error-text">{order.error}</p>
          ) : null}

          <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              onClick={onConfirmPayment}
              disabled={order.saving}
            >
              {order.saving ? "Confirming..." : "I have paid (confirm)"}
            </button>
            <button type="button" className="secondary-btn" onClick={onNewOrder} disabled={order.saving}>
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default Confirmation;
