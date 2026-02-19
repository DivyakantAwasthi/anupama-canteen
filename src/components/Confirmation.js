import { QRCodeCanvas } from "qrcode.react";

const STATUS_STEPS = [
  { id: "pending_payment", label: "Awaiting payment" },
  { id: "payment_verified", label: "Payment verified" },
  { id: "preparing", label: "Preparing order" },
  { id: "ready_for_pickup", label: "Ready for pickup" },
];

const STATUS_MESSAGE = {
  pending_payment: "Please complete the payment to start your order.",
  payment_verified: "Payment is verified. Your order will move to preparation soon.",
  preparing: "Kitchen is preparing your order now.",
  ready_for_pickup: "Your order is ready. Please collect it at the counter.",
};

function getStepState(orderStatus, stepId) {
  const currentIndex = STATUS_STEPS.findIndex((step) => step.id === orderStatus);
  const stepIndex = STATUS_STEPS.findIndex((step) => step.id === stepId);

  if (stepIndex < currentIndex) {
    return "done";
  }

  if (stepIndex === currentIndex) {
    return "active";
  }

  return "todo";
}

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

  if (!order) {
    return null;
  }

  return (
    <section className="panel confirmation-panel">
      <h2>{order.paid ? "Order in Progress" : "Awaiting Payment"}</h2>
      <p className="muted-text">{STATUS_MESSAGE[order.status]}</p>

      <p>
        <strong>Order ID:</strong> {order.orderId}
      </p>
      <p>
        <strong>Total:</strong> Rs. {amount}
      </p>

      <ol className="status-timeline">
        {STATUS_STEPS.map((step) => {
          const state = getStepState(order.status, step.id);
          return (
            <li key={step.id} className={`status-step ${state}`}>
              {step.label}
            </li>
          );
        })}
      </ol>

      {!order.paid ? (
        <>
          <div className="qr-wrap">
            <QRCodeCanvas value={qrValue} size={220} includeMargin />
          </div>
          <p className="muted-text">Scan to pay via UPI</p>
          <p className="muted-text">
            <strong>UPI ID:</strong> {upiId}
          </p>
        </>
      ) : null}

      {order.error ? <p className="error-text">{order.error}</p> : null}

      <div className="confirmation-actions">
        {!order.paid ? (
          <button type="button" onClick={onConfirmPayment} disabled={order.saving}>
            {order.saving ? "Confirming..." : "I have paid (confirm)"}
          </button>
        ) : null}
        <button
          type="button"
          className="secondary-btn"
          onClick={onNewOrder}
          disabled={order.saving}
        >
          {order.paid ? "Place New Order" : "Cancel"}
        </button>
      </div>
    </section>
  );
}

export default Confirmation;
