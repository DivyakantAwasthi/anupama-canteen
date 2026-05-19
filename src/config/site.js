const BUSINESS_PHONE = String(process.env.REACT_APP_BUSINESS_PHONE || "9838383231").trim();
const RAW_PHONE_DIGITS = BUSINESS_PHONE.replace(/\D/g, "");
const SANITIZED_PHONE =
  RAW_PHONE_DIGITS.length === 12 && RAW_PHONE_DIGITS.startsWith("91")
    ? RAW_PHONE_DIGITS.slice(2)
    : RAW_PHONE_DIGITS;
const DISPLAY_PHONE =
  SANITIZED_PHONE.length === 10
    ? `+91 ${SANITIZED_PHONE.slice(0, 5)} ${SANITIZED_PHONE.slice(5)}`
    : BUSINESS_PHONE;
const MAPS_LINK = String(
  process.env.REACT_APP_GOOGLE_MAPS_URL || "https://g.page/r/CSEAz_a6ceGfECI"
).trim();

// WhatsApp Catalog link (no pre-filled message)
export const WHATSAPP_CATALOG_LINK = `https://wa.me/c/91${SANITIZED_PHONE}`;

export const SITE_CONTENT = {
  name: "Anupama Canteen",
  city: "Lucknow",
  region: "Uttar Pradesh",
  serviceArea: "Local pickup and quick delivery across Lucknow",
  phone: SANITIZED_PHONE,
  displayPhone: DISPLAY_PHONE,
  callLink: `tel:+91${SANITIZED_PHONE}`,
  mapsLink: MAPS_LINK,
  whatsappLink: WHATSAPP_CATALOG_LINK,
  fssaiNumber: process.env.REACT_APP_FSSAI_NUMBER || "22726739000468",
  address:
    process.env.REACT_APP_BUSINESS_ADDRESS ||
    "Anupama Canteen, Ghaila Road, Lucknow",
  since: "2010",
  heroHeading: "Lucknow snacks, served fresh and ready fast.",
  heroSubheading:
    "Order pav bhaji, sandwiches, maggi, dosa, tea, and quick meals from a trusted local canteen with UPI and WhatsApp ordering.",
  heroImage: "/images/cheese-vada-pav.jpg",
  heroImageFallback: "/menu-placeholder.svg",
  primaryCta: "Start Your Order",
  secondaryCta: "Browse Menu",
  deliveryMessage: "Fast pickup and local delivery support",
  seoTitle:
    "Anupama Canteen | Hygienic Snacks in Lucknow | Pav Bhaji & Fast Food",
  seoDescription:
    "Order hygienic snacks in Lucknow from Anupama Canteen. Fresh pav bhaji, sandwiches, maggi, dosa, tea, and fast snacks near you with UPI and WhatsApp support.",
  seoKeywords: [
    "snacks in Lucknow",
    "pav bhaji Lucknow",
    "fast snacks near me",
    "hygienic snacks Lucknow",
    "sandwiches Lucknow",
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
  // Use catalog link for ordering - no pre-filled message
  return WHATSAPP_CATALOG_LINK;
};
