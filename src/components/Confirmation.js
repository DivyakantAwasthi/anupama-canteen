import { QRCodeCanvas } from "qrcode.react";
import { createWhatsAppOrderLink } from "../config/site";

const ORDER_STATUS_COPY = {
  pending_payment: "Awaiting payment confirmation",
  payment_verified: "Payment received",
  preparing: "Kitchen is preparing your order",
  ready_for_pickup: "Order is ready for pickup",
  delivered: "Order completed",
  cancelled: "Order cancelled",
};

function Confirmation({
  order,
  onConfirmPayment,
  onSelectCashAtCounter,
  onNewOrder,
  business,
}) {
  if (!order) {
    return null;
  }

  const upiId = String(process.env.REACT_APP_UPI_ID || "9838383231@ptsbi")
    .trim()
    .toLowerCase();
  const payeeName = process.env.REACT_APP_UPI_PAYEE_NAME || "Utkarsh Shukla";
  const amount = Number(order.total || 0).toFixed(2);
  const note = `Order ${order.orderId}`;
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
    payeeName
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  const whatsappLink = createWhatsAppOrderLink({
    orderId: order.orderId,
    customerName: order.customer?.name,
    total: order.total,
    items: order.items,
  });
  const isPaid = Boolean(order.paidAt);
  const isCashOrder = order.paymentMode === "cash_counter";

  return (
    <section className="confirmation-shell">
      <div className="confirmation-card">
        <p className="eyebrow">Order received</p>
        <h1>Thanks, {order.customer?.name || "guest"}.</h1>
        <p className="confirmation-lead">
          Your order has been saved. Use the payment option below to move it into the kitchen
          queue.
        </p>

        <div className="confirmation-grid">
          <div className="confirmation-summary">
            <div className="summary-tile">
              <span>Order ID</span>
              <strong>#{order.orderId}</strong>
            </div>
            <div className="summary-tile">
              <span>Status</span>
              <strong>{ORDER_STATUS_COPY[order.status] || order.status}</strong>
            </div>
            <div className="summary-tile">
              <span>Total</span>
              <strong>Rs. {amount}</strong>
            </div>
            <div className="summary-tile">
              <span>Support</span>
              <strong>{business.displayPhone}</strong>
            </div>
          </div>

          <div className="confirmation-payment">
            {!isPaid && !isCashOrder ? (
              <>
                <div className="qr-card">
                  <QRCodeCanvas value={upiLink} size={200} includeMargin />
                </div>
                <p className="muted-copy">Scan to pay via UPI</p>
                <div className="confirmation-actions">
                  <a href={upiLink} className="primary-btn">
                    Open UPI app
                  </a>
                  <button
                    type="button"
                    className="soft-btn"
                    onClick={onConfirmPayment}
                    disabled={order.saving}
                  >
                    {order.saving ? "Confirming..." : "I have paid"}
                  </button>
                  <button
                    type="button"
                    className="soft-btn"
                    onClick={onSelectCashAtCounter}
                    disabled={order.saving}
                  >
                    Pay at counter
                  </button>
                </div>
                <p className="muted-copy">UPI ID: {upiId}</p>
              </>
            ) : null}

            {isCashOrder && !isPaid ? (
              <div className="status-card">
                <p>Cash at counter is selected. Please pay when you collect your order.</p>
              </div>
            ) : null}

            {isPaid ? (
              <div className="status-card success">
                <p>Your payment has been recorded. We&apos;ll keep your order status updated.</p>
              </div>
            ) : null}
          </div>
        </div>

        {order.error ? <p className="inline-error">{order.error}</p> : null}

        <div className="support-actions">
          <a href={whatsappLink} target="_blank" rel="noreferrer" className="soft-btn">
            WhatsApp support
          </a>
          <a href={business.callLink} className="soft-btn">
            Call {business.displayPhone}
          </a>
          <button type="button" className="link-btn" onClick={onNewOrder}>
            Start another order
          </button>
        </div>
      </div>
    </section>
  );
}

export default Confirmation;
