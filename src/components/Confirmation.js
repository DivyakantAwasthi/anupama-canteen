import { QRCodeCanvas } from "qrcode.react";

function Confirmation({ orderId, total, onNewOrder }) {
  const upiId = process.env.REACT_APP_UPI_ID || "9807980222@ptsbi";
  const payeeName = process.env.REACT_APP_UPI_PAYEE_NAME || "Utkarsh Shukla";
  const amount = total.toFixed(2);
  const note = `Order ${orderId}`;
  const qrValue = `upi://pay?pa=${encodeURIComponent(
    upiId
  )}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(
    note
  )}`;

  return (
    <section className="panel confirmation-panel">
      <h2>Order Confirmed</h2>
      <p>Your order has been saved successfully.</p>
      <p>
        <strong>Order ID:</strong> {orderId}
      </p>
      <p>
        <strong>Total:</strong> Rs. {total.toFixed(2)}
      </p>

      <div className="qr-wrap">
        <QRCodeCanvas value={qrValue} size={220} includeMargin />
      </div>
      <p className="muted-text">Scan to pay via UPI</p>
      <p className="muted-text">
        <strong>UPI ID:</strong> {upiId}
      </p>

      <button type="button" onClick={onNewOrder}>
        Place New Order
      </button>
    </section>
  );
}

export default Confirmation;
