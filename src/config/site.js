const BUSINESS_PHONE = process.env.REACT_APP_BUSINESS_PHONE || "9807980222";
const SANITIZED_PHONE = BUSINESS_PHONE.replace(/\D/g, "");
const DISPLAY_PHONE =
  SANITIZED_PHONE.length === 10
    ? `+91 ${SANITIZED_PHONE.slice(0, 5)} ${SANITIZED_PHONE.slice(5)}`
    : BUSINESS_PHONE;

export const SITE_CONTENT = {
  name: "Anupama Canteen",
  city: "Lucknow",
  region: "Uttar Pradesh",
  serviceArea: "Local pickup and quick delivery across Lucknow",
  phone: SANITIZED_PHONE,
  displayPhone: DISPLAY_PHONE,
  callLink: `tel:+91${SANITIZED_PHONE}`,
  whatsappLink: `https://wa.me/91${SANITIZED_PHONE}?text=${encodeURIComponent(
    "Hi Anupama Canteen, I want to place an order."
  )}`,
  fssaiNumber: process.env.REACT_APP_FSSAI_NUMBER || "FSSAI details available on request",
  address:
    process.env.REACT_APP_BUSINESS_ADDRESS ||
    "Anupama Canteen, Lucknow, Uttar Pradesh",
  since: "2010",
  heroHeading: "Fresh snacks in Lucknow, ready fast and packed with care.",
  heroSubheading:
    "Order pav bhaji, sandwiches, maggi, dosa, tea, and quick meals from a cleaner, faster local ordering experience.",
  primaryCta: "Start Your Order",
  secondaryCta: "Browse Menu",
  deliveryMessage: "Fast pickup and local delivery support",
  seoTitle:
    "Anupama Canteen | Snacks in Lucknow | Pav Bhaji, Sandwiches & Fast Food",
  seoDescription:
    "Order snacks in Lucknow from Anupama Canteen. Freshly prepared pav bhaji, sandwiches, maggi, dosa, tea, and more with fast ordering, WhatsApp support, and pickup updates.",
  seoKeywords: [
    "snacks in Lucknow",
    "pav bhaji Lucknow",
    "food delivery Lucknow",
    "Lucknow canteen food",
    "Lucknow fast food",
  ],
  trustPoints: [
    "Serving Since 2010",
    "Hygienic Kitchen",
    "Freshly Prepared",
    "Fast Delivery",
  ],
};

export const createWhatsAppOrderLink = ({
  orderId,
  customerName,
  total,
  items,
} = {}) => {
  const details = [
    "Hi Anupama Canteen, I need help with my order.",
    orderId ? `Order ID: ${orderId}` : "",
    customerName ? `Name: ${customerName}` : "",
    total ? `Total: Rs. ${Number(total).toFixed(2)}` : "",
    items ? `Items: ${items}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/91${SANITIZED_PHONE}?text=${encodeURIComponent(details)}`;
};
