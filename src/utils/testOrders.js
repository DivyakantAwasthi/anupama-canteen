/**
 * Test order utility for validating order integrity
 * Generates test orders and validates the complete flow
 */

const TEST_ORDERS = [
  {
    name: "Test: Single Vada Pav",
    items: [
      { name: "Vada Pav", quantity: 1, price: 40 },
    ],
    customer: {
      name: "Test User 1",
      email: "test1@example.com",
      phone: "9876543210",
    },
  },
  {
    name: "Test: Multiple Items",
    items: [
      { name: "Vada Pav", quantity: 2, price: 40 },
      { name: "Samosa", quantity: 1, price: 30 },
      { name: "Tea", quantity: 1, price: 20 },
    ],
    customer: {
      name: "Test User 2",
      email: "test2@example.com",
      phone: "9876543211",
    },
  },
  {
    name: "Test: Large Order",
    items: [
      { name: "Cheese Vada Pav", quantity: 3, price: 50 },
      { name: "Club Sandwich", quantity: 2, price: 30 },
      { name: "Dosa", quantity: 2, price: 70 },
    ],
    customer: {
      name: "Test User 3",
      email: "test3@example.com",
      phone: "9876543212",
    },
  },
];

export const generateTestOrder = (templateIndex = 0) => {
  const template = TEST_ORDERS[templateIndex % TEST_ORDERS.length];
  const timestamp = new Date().toISOString();
  const dateKey = timestamp.slice(0, 10);
  const orderId = Math.floor(Math.random() * 900000) + 100000;

  const itemsString = template.items
    .map((item) => `${item.name} x${item.quantity}`)
    .join(", ");

  const total = template.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return {
    orderId,
    orderDateKey: dateKey,
    createdAt: timestamp,
    paidAt: null,
    paymentMode: "upi",
    status: "pending_payment",
    total,
    items: itemsString,
    customer: {
      name: template.customer.name,
      email: template.customer.email,
      phone: template.customer.phone,
    },
    error: null,
    saving: false,
  };
};

export const validateOrderIntegrity = (orderFromUI, orderFromSheet) => {
  if (!orderFromSheet) {
    return { valid: false, errors: ["Order not found in sheet"] };
  }

  const errors = [];

  if (String(orderFromUI.orderId) !== String(orderFromSheet.orderId)) {
    errors.push(`Order ID mismatch: UI=${orderFromUI.orderId}, Sheet=${orderFromSheet.orderId}`);
  }

  const uiItems = String(orderFromUI.items || "").trim();
  const sheetItems = String(orderFromSheet.items || "").trim();

  if (uiItems !== sheetItems) {
    errors.push(`Items mismatch: UI="${uiItems}", Sheet="${sheetItems}"`);
  }

  if (Number(orderFromUI.total).toFixed(2) !== Number(orderFromSheet.total).toFixed(2)) {
    errors.push(`Total mismatch: UI=${orderFromUI.total}, Sheet=${orderFromSheet.total}`);
  }

  const expectedStatus = orderFromUI.status || "pending_payment";
  const actualStatus = orderFromSheet.status || "pending_payment";

  if (expectedStatus !== actualStatus) {
    errors.push(`Status mismatch: Expected=${expectedStatus}, Actual=${actualStatus}`);
  }

  if (String(orderFromUI.customer.name || "").trim() !== String(orderFromSheet.customerName || "").trim()) {
    errors.push(`Customer name mismatch: UI="${orderFromUI.customer.name}", Sheet="${orderFromSheet.customerName}"`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const logOrderDebug = (label, order) => {
  console.log(`[OrderDebug] ${label}:`, {
    orderId: order.orderId,
    items: order.items,
    total: order.total,
    status: order.status,
    customer: order.customer?.name,
  });
};

export const validateNoDuplicates = (orders) => {
  const seen = new Set();
  const duplicates = [];

  for (const order of orders) {
    const key = `${order.orderId}`;
    if (seen.has(key)) {
      duplicates.push(key);
    }
    seen.add(key);
  }

  return {
    hasDuplicates: duplicates.length > 0,
    duplicateCount: duplicates.length,
    duplicateIds: duplicates,
  };
};
