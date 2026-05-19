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

export const generateTestOrder = (templateIndex = 0) => {\n  const template = TEST_ORDERS[templateIndex % TEST_ORDERS.length];\n  const timestamp = new Date().toISOString();\n  const dateKey = timestamp.slice(0, 10);\n  const orderId = Math.floor(Math.random() * 900000) + 100000;\n\n  const itemsString = template.items\n    .map((item) => `${item.name} x${item.quantity}`)\n    .join(\", \");\n\n  const total = template.items.reduce(\n    (sum, item) => sum + item.price * item.quantity,\n    0\n  );\n\n  const order = {\n    orderId,\n    orderDateKey: dateKey,\n    createdAt: timestamp,\n    paidAt: null,\n    paymentMode: \"upi\",\n    status: \"pending_payment\",\n    total,\n    items: itemsString,\n    customer: {\n      name: template.customer.name,\n      email: template.customer.email,\n      phone: template.customer.phone,\n    },\n    error: null,\n    saving: false,\n  };\n\n  return order;\n};\n\nexport const validateOrderIntegrity = (orderFromUI, orderFromSheet) => {\n  if (!orderFromSheet) {\n    return { valid: false, errors: [\"Order not found in sheet\"] };\n  }\n\n  const errors = [];\n\n  if (Number(orderFromUI.orderId) !== Number(orderFromSheet.orderId)) {\n    errors.push(`Order ID mismatch: UI=${orderFromUI.orderId}, Sheet=${orderFromSheet.orderId}`);\n  }\n\n  const uiItems = String(orderFromUI.items || \"\").trim();\n  const sheetItems = String(orderFromSheet.items || \"\").trim();\n\n  if (uiItems !== sheetItems) {\n    errors.push(`Items mismatch: UI=\"${uiItems}\", Sheet=\"${sheetItems}\"`);\n  }\n\n  if (Number(orderFromUI.total).toFixed(2) !== Number(orderFromSheet.total).toFixed(2)) {\n    errors.push(`Total mismatch: UI=${orderFromUI.total}, Sheet=${orderFromSheet.total}`);\n  }\n\n  const expectedStatus = orderFromUI.status || \"pending_payment\";\n  const actualStatus = orderFromSheet.status || \"pending_payment\";\n\n  if (expectedStatus !== actualStatus) {\n    errors.push(`Status mismatch: Expected=${expectedStatus}, Actual=${actualStatus}`);\n  }\n\n  if (String(orderFromUI.customer.name || \"\").trim() !== String(orderFromSheet.customerName || \"\").trim()) {\n    errors.push(`Customer name mismatch: UI=\"${orderFromUI.customer.name}\", Sheet=\"${orderFromSheet.customerName}\"`);\n  }\n\n  return {\n    valid: errors.length === 0,\n    errors,\n  };\n};\n\nexport const logOrderDebug = (label, order) => {\n  console.log(`[OrderDebug] ${label}:`, {\n    orderId: order.orderId,\n    items: order.items,\n    total: order.total,\n    status: order.status,\n    customer: order.customer?.name,\n  });\n};\n\nexport const validateNoDuplicates = (orders) => {\n  const seen = new Set();\n  const duplicates = [];\n\n  for (const order of orders) {\n    const key = `${order.orderId}`;\n    if (seen.has(key)) {\n      duplicates.push(key);\n    }\n    seen.add(key);\n  }\n\n  return {\n    hasDuplicates: duplicates.length > 0,\n    duplicateCount: duplicates.length,\n    duplicateIds: duplicates,\n  };\n};\n