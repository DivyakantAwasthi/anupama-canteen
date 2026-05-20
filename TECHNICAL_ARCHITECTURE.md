# TECHNICAL ARCHITECTURE REFERENCE

**Version**: 2.0  
**Last Updated**: 2026-05-20  
**Status**: Production Active

---

## SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                      WEB APPLICATION                            │
│                  (React 18 + Node.js Vercel)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Frontend Components (React)                           │    │
│  │  ├── Menu.js (Browse items)                           │    │
│  │  ├── Cart.js (Add/remove items - IMMUTABLE SNAPSHOT)  │    │
│  │  ├── Confirmation.js (Order details - VALIDATED)      │    │
│  │  ├── KitchenMonitor.js (Status updates - SYNC)        │    │
│  │  └── CustomerDisplay.js (Public view - AUTO-SYNC)     │    │
│  └────────────────────────────────────────────────────────┘    │
│            ↓                                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  State Management (Hooks + localStorage)              │    │
│  │  ├── useState: cart, orderDetails, orders            │    │
│  │  ├── useEffect: polling, reconciliation              │    │
│  │  └── localStorage: persistence across sessions       │    │
│  └────────────────────────────────────────────────────────┘    │
│            ↓                                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Service Layer (Direct API Communication)             │    │
│  │  ├── sheetsService.js (Append orders, build payloads) │    │
│  │  ├── ordersMonitorService.js (Fetch & update status)  │    │
│  │  └── orderSyncService.js (NEW: Sync & reconcile)      │    │
│  └────────────────────────────────────────────────────────┘    │
│            ↓                                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Backend API Endpoints (Node.js/Vercel)               │    │
│  │  ├── /api/append-order (Create new order)             │    │
│  │  ├── /api/orders-monitor (Status updates)             │    │
│  │  ├── /api/verify-order (Check existence)              │    │
│  │  ├── /api/health (System status)                      │    │
│  │  ├── /api/reviews (Review management)                 │    │
│  │  └── /api/whatsapp-notify (Notifications)             │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│         GOOGLE SHEETS (SINGLE SOURCE OF TRUTH)                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────┐           │
│  │ Orders Sheet                                    │           │
│  │ ├── Order ID (unique, auto-increment)           │           │
│  │ ├── Date (creation date)                        │           │
│  │ ├── Customer Name                               │           │
│  │ ├── Phone Number                                │           │
│  │ ├── Items (deep-cloned snapshot)                │           │
│  │ ├── Total (calculated)                          │           │
│  │ ├── Status (Pending/Preparing/Ready/etc)        │           │
│  │ ├── Payment Type (Cash/UPI)                      │           │
│  │ ├── Notes                                       │           │
│  │ └── Timestamp (update tracking)                 │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                  │
│  ┌─────────────────────────────────────────────────┐           │
│  │ Reviews Sheet (Reviews management)              │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                  │
│  ┌─────────────────────────────────────────────────┐           │
│  │ Audit Log (Deployment tracking)                 │           │
│  └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                  ↑           (Source of Truth)
                  │
        ┌─────────┴─────────┐
        ↓                   ↓
    WhatsApp         Third-party Tools
    Notifications    (Reports, Analytics)
```

---

## DATA FLOW: ORDER CREATION

```
1. USER INTERACTION
   └─→ Clicks menu item (e.g., "2 Idli")
   
2. CART STATE UPDATE
   └─→ cartItems = [...cartItems, { name: "Idli", quantity: 2, price: 40 }]
   
3. IMMUTABLE SNAPSHOT (KEY FIX #1)
   ┌─────────────────────────────────────────┐
   │ const cartSnapshot = JSON.parse(        │
   │   JSON.stringify(cartItems)             │
   │ );                                      │
   │ → Creates independent deep copy         │
   │ → No shared references                  │
   │ → Protected from mutations              │
   └─────────────────────────────────────────┘
   
4. ITEMS STRING CREATION
   └─→ items = "Idli x2" (from snapshot)
   
5. ORDER OBJECT CREATION
   └─→ {
         orderId: "unique-id",
         items: "Idli x2",
         cartSnapshot: {...}, // Reference for validation
         status: "Pending",
         total: 80,
         timestamp: Date.now()
       }
   
6. VALIDATION LAYER #1 (App.js)
   ┌─────────────────────────────────────────┐
   │ if (!orderSnapshot.items ||             │
   │     orderSnapshot.items.length === 0) { │
   │   throw Error('Items corrupted');        │
   │ }                                       │
   └─────────────────────────────────────────┘
   
7. PAYMENT FLOW
   └─→ selectCashAtCounter() or confirmPayment()
   
8. VALIDATION LAYER #2 (App.js)
   └─→ Verify items not empty before sending
   
9. SEND TO SHEETS SERVICE
   └─→ appendOrderToSheet(order)
   
10. VALIDATION LAYER #3 (sheetsService.js)
    ┌─────────────────────────────────────────┐
    │ const itemsStr = String(items || "")    │
    │ if (!itemsStr || !itemsStr.includes('x'))│
    │   throw Error('Invalid items format');   │
    └─────────────────────────────────────────┘
    
11. DUPLICATE CHECK (append-order.js)
    └─→ Query sheet for existing order ID
    └─→ If found: return 409 (conflict)
    └─→ If not found: proceed to append
    
12. APPEND TO GOOGLE SHEETS
    └─→ POST to Google Apps Script endpoint
    └─→ New row created with order data
    
13. RESPONSE RECEIVED
    └─→ Order ID: "123"
    └─→ Timestamp: confirmed
    
14. STATE UPDATE
    └─→ setOrderDetails(null)
    └─→ setCartItems([])
    └─→ Clear localStorage
    
15. SUCCESS NOTIFICATION
    └─→ "Order placed successfully!"
    └─→ Display confirmation receipt
```

**Result**: Order stored in Google Sheets with EXACT items (Idli x2), not corrupted.

---

## DATA FLOW: STATUS SYNCHRONIZATION

### Path 1: Kitchen Panel → Google Sheet

```
1. USER: Click status button on order card
   └─→ Kitchen Panel component detects click
   
2. STATUS CHANGE REQUESTED
   └─→ changeStatus({ orderId, newStatus })
   └─→ KitchenMonitor.js line ~85
   
3. VALIDATE ORDER EXISTS
   └─→ ordersMonitorService.updateKitchenOrderStatus()
   └─→ First: fetch order from sheet to verify
   └─→ If 404: order deleted, remove card
   └─→ If found: proceed to update
   
4. SYNC TO SHEET
   └─→ orderSyncService.syncStatusToSheet({
         orderId,
         status,
         orderDate,
         timestamp,
         source: "kitchen_panel"
       })
   
5. EXPLICIT UPDATE ACTION (KEY FIX #2)
   ┌─────────────────────────────────────────┐
   │ body: {                                 │
   │   orderId: "123",                       │
   │   status: "Preparing",                  │
   │   action: "updateOrderStatus",          │
   │   source: "kitchen_panel"               │
   │ }                                       │
   │                                         │
   │ → Prevents fallback to APPEND           │
   │ → Ensures only UPDATE occurs            │
   │ → No duplicate rows created             │
   └─────────────────────────────────────────┘
   
6. GOOGLE APPS SCRIPT PROCESSES UPDATE
   └─→ Finds row with matching Order ID
   └─→ Updates Status column
   └─→ Updates Timestamp
   └─→ NO NEW ROW CREATED
   
7. RESPONSE RETURNED
   └─→ Status: 200 OK
   └─→ Updated order data
   
8. KITCHEN PANEL STATE UPDATED
   └─→ Order card shows new status
   └─→ UI reflects change immediately
```

### Path 2: Google Sheet (Manual) → All Displays

```
1. ADMIN: Manually edit status in Google Sheet
   └─→ Changes "Pending" to "Ready" in cell
   └─→ Presses Enter to confirm
   
2. POLLING CYCLE TRIGGERED (Every 7 seconds)
   └─→ All displays run fetch on interval
   
3. KITCHEN PANEL POLLS
   └─→ orderSyncService.fetchOrdersFromSheet()
   └─→ Fetches all orders for date
   └─→ Deduplicates by Order ID
   
4. RECONCILIATION (KEY FIX #3)
   ┌─────────────────────────────────────────┐
   │ orderSyncService.reconcileOrders({      │
   │   frontendOrders: [...],                │
   │   sheetOrders: [...]                    │
   │ })                                      │
   │                                         │
   │ → Compares local state with sheet      │
   │ → Updates statuses from sheet           │
   │ → Removes ghost orders                  │
   │ → Returns reconciled list               │
   └─────────────────────────────────────────┘
   
5. CHANGE DETECTION
   └─→ New orders: update[] with new data
   └─→ Updated orders: update[] with new status
   └─→ Deleted orders: remove[] with IDs
   
6. KITCHEN PANEL UPDATES
   └─→ Order card now shows "Ready"
   └─→ Update happened silently
   └─→ No page refresh needed
   
7. CUSTOMER DISPLAY UPDATES
   └─→ Same polling cycle
   └─→ Sees updated status within 7 seconds
```

---

## DATA STRUCTURE: ORDER OBJECT

### Complete Order Structure

```javascript
{
  // IDENTIFICATION
  orderId: "123",              // Unique, auto-incremented
  date: "2026-05-20",          // YYYY-MM-DD format
  
  // CUSTOMER INFO
  customerName: "John Doe",
  phoneNumber: "9876543210",
  
  // ORDER ITEMS (KEY: IMMUTABLE SNAPSHOT)
  items: "Idli x2, Dosa x1",   // Items string with snapshot
  cartSnapshot: {              // Original cart state preserved
    [{ name: "Idli", quantity: 2, price: 40 },
     { name: "Dosa", quantity: 1, price: 60 }]
  },
  
  // PRICING
  subtotal: 140,
  tax: 0,
  total: 140,
  
  // STATUS TRACKING
  status: "Pending",           // Enum: Pending, Preparing, Ready, Delivering, Delivered
  statusHistory: [             // Track all changes
    { status: "Pending", timestamp: "14:30:00", source: "frontend" },
    { status: "Preparing", timestamp: "14:31:00", source: "kitchen_panel" },
    { status: "Ready", timestamp: "14:33:00", source: "kitchen_panel" }
  ],
  
  // PAYMENT
  paymentMethod: "Cash",       // Cash or UPI
  paymentStatus: "Pending",    // Pending, Confirmed, etc.
  
  // METADATA
  notes: "Extra spicy",
  timestamp: 1716200400000,    // Created timestamp (ms since epoch)
  lastUpdated: 1716200406000,  // Last update timestamp
  source: "frontend",          // Where order originated
  
  // VALIDATION FLAGS
  validated: true,             // Passed all integrity checks
  duplicateCheckPassed: true,  // No existing order with this ID
  itemsValidated: true         // Items format verified
}
```

### Validation Rules

```javascript
// In orderSyncService.validateOrderIntegrity()
{
  orderId: Number > 0,              // Must be positive integer
  items: String, length > 0,        // Not empty
  total: Number > 0,                // Must be positive
  customerName: String, length > 0, // Not empty
  phoneNumber: String, length >= 10,// Valid format
  status: oneOf([
    "Pending",
    "Preparing", 
    "Ready",
    "Delivering",
    "Delivered"
  ]),
  timestamp: Number,                // Valid epoch timestamp
  date: Regex /^\d{4}-\d{2}-\d{2}$/ // YYYY-MM-DD format
}
```

---

## SERVICE LAYER REFERENCE

### sheetsService.js

**Purpose**: Direct communication with Google Sheets for order operations

**Key Functions**:

1. **appendOrderToSheet(order)**
   - Creates new order row
   - Validates items not empty
   - Checks for duplicates
   - Returns: { orderId, timestamp }

2. **buildOrderPayload(order)**
   - Converts order object to sheet format
   - Validates items format
   - Adds validation checks
   - Returns: { orderId, customerName, items, ... }

3. **deepCloneOrder(order)**
   - Creates independent copy
   - Uses JSON.stringify/parse
   - Prevents reference aliasing
   - Returns: Independent order object

4. **fetchOrderStatusFromSheet(orderId, date)**
   - Queries sheet for single order
   - Returns: { orderId, status, timestamp }

### ordersMonitorService.js

**Purpose**: Fetch and update order status from displays

**Key Functions**:

1. **fetchKitchenOrders(date)**
   - Gets all orders for date
   - Used by Kitchen Panel
   - Returns: [{orderId, status, ...}]

2. **updateKitchenOrderStatus(orderId, status)**
   - Updates order status
   - Validates order exists first
   - Returns: Updated order object

### orderSyncService.js (NEW)

**Purpose**: Bidirectional synchronization and reconciliation

**Key Functions**:

1. **syncStatusToSheet({ orderId, status, orderDate, timestamp })**
   ```javascript
   // Only UPDATE, never APPEND
   POST /api/orders-monitor
   body: { orderId, status, action: "updateOrderStatus" }
   ```

2. **fetchOrdersFromSheet({ date })**
   ```javascript
   // Fetch and deduplicate
   GET from Google Apps Script
   Deduplicate by Order ID (keep latest)
   Return clean array
   ```

3. **detectGhostOrders({ frontendOrders, sheetOrders })**
   ```javascript
   // Find orders in frontend but not sheet
   Compare IDs
   Return orphaned order IDs
   ```

4. **reconcileOrders({ frontendOrders, sheetOrders })**
   ```javascript
   // Merge frontend + sheet data
   Remove ghosts
   Update statuses from sheet
   Return merged list
   ```

5. **validateOrderIntegrity(order)**
   ```javascript
   // Check all required fields
   Verify data types
   Validate ranges/formats
   Throw error if invalid
   ```

6. **startOrderMonitoring({ onOrdersChange, onGhostOrdersDetected, pollInterval, date })**
   ```javascript
   // Background polling
   Fetch orders every pollInterval (7s)
   Detect changes (new, removed, updated)
   Call callbacks when changes detected
   Continue indefinitely
   ```

---

## VALIDATION PIPELINE

```
Order Creation
   ↓
Frontend Validation (App.js)
├─ Items not empty? 
├─ CartSnapshot created?
└─ → Reject if failed → Show error

   ↓
Service Layer Validation (sheetsService.js)
├─ Items string valid?
├─ Contains "x" separator?
├─ Length > 0?
└─ → Reject if failed → Throw error

   ↓
Backend Duplicate Check (api/append-order.js)
├─ Order ID exists in sheet?
├─ Status from query?
└─ → Return 409 if duplicate

   ↓
Google Apps Script Append
├─ Validate format
├─ Create row
└─ → Return orderId if success

   ↓
Sync Service Validation (orderSyncService.js)
├─ Order ID valid?
├─ Items exist?
├─ Total > 0?
├─ Customer name exists?
└─ → Used for reconciliation

   ↓
✅ Order Stored Successfully
```

---

## RECONCILIATION ALGORITHM

```javascript
// Pseudocode: reconcileOrders()

function reconcileOrders(frontendOrders, sheetOrders) {
  
  // Step 1: Deduplicate sheet orders (keep latest)
  const sheetMap = new Map();
  for (const order of sheetOrders) {
    const existing = sheetMap.get(order.orderId);
    if (!existing || order.timestamp > existing.timestamp) {
      sheetMap.set(order.orderId, order);
    }
  }
  
  // Step 2: Identify ghost orders (in frontend, not in sheet)
  const ghosts = [];
  for (const order of frontendOrders) {
    if (!sheetMap.has(order.orderId)) {
      ghosts.push(order.orderId);
    }
  }
  
  // Step 3: Merge data (sheet is source of truth)
  const reconciled = [];
  for (const sheetOrder of sheetMap.values()) {
    const frontendOrder = frontendOrders.find(o => o.orderId === sheetOrder.orderId);
    
    // Sheet status takes precedence
    const merged = {
      ...frontendOrder,
      ...sheetOrder,
      status: sheetOrder.status, // SHEET IS SOURCE OF TRUTH
      lastUpdated: Math.max(
        frontendOrder?.lastUpdated || 0,
        sheetOrder.lastUpdated || 0
      )
    };
    
    reconciled.push(merged);
  }
  
  // Step 4: Remove ghosts from reconciled
  return reconciled.filter(o => !ghosts.includes(o.orderId));
}
```

---

## POLLING FLOW (7-SECOND CYCLE)

```
Every 7 seconds:
   ↓
fetchOrdersFromSheet()
   ├─ GET from Google Apps Script
   ├─ Parse response
   ├─ Deduplicate by Order ID
   └─ Return clean array
   ↓
Comparison with previous state
   ├─ New: { orderId in sheet, not in local }
   ├─ Removed: { orderId in local, not in sheet }
   └─ Updated: { orderId exists, status changed }
   ↓
reconcileOrders()
   ├─ Merge frontend + sheet
   ├─ Remove ghosts
   ├─ Update statuses
   └─ Return merged list
   ↓
Change Detection
   ├─ new.length > 0? → Call onOrdersChange()
   ├─ removed.length > 0? → Call onGhostOrdersDetected()
   ├─ updated.length > 0? → Call onOrdersChange()
   └─ Nothing? → Silent cycle
   ↓
Update UI Components
   ├─ KitchenMonitor.setOrders(reconciled)
   ├─ CustomerDisplay.setOrders(reconciled)
   └─ Remove ghost cards from DOM
   ↓
Wait 7 seconds → Repeat
```

---

## ERROR HANDLING STRATEGY

### Critical Errors (Fail Fast)

```javascript
// These errors prevent order placement
if (!items || items.length === 0) {
  throw new Error("Order items corrupted. Please try again.");
}

if (!customerName || customerName.length === 0) {
  throw new Error("Customer name required.");
}

if (!phoneNumber || phoneNumber.length < 10) {
  throw new Error("Valid phone number required.");
}
```

### Non-Critical Errors (Log & Continue)

```javascript
// These errors don't block, but are logged
if (duplicateCheckFailed) {
  console.warn("[AppendOrder] Duplicate check failed, but continuing");
  // Attempt to append anyway (may fail on backend)
}

if (googleSheetsApiSlow) {
  console.warn("[OrderSync] Sheet API slow (1600ms+)");
  // Continue polling, warn user
}
```

### API Errors (Retry Logic)

```javascript
// Network errors, timeouts, temporary failures
const response = await fetchWithRetry(url, {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2
});
```

---

## PERFORMANCE OPTIMIZATION

### Frontend Caching

```javascript
// Cache orders in memory with TTL
const orderCache = {
  data: [],
  timestamp: 0,
  ttl: 7000, // Match polling interval
  
  isValid() {
    return Date.now() - this.timestamp < this.ttl;
  }
};
```

### Deduplication Performance

```javascript
// O(n) dedup using Map instead of filter
const dedup = (orders) => {
  const map = new Map();
  for (const order of orders) {
    const key = order.orderId;
    const existing = map.get(key);
    if (!existing || order.timestamp > existing.timestamp) {
      map.set(key, order);
    }
  }
  return Array.from(map.values());
};
```

### Batch Updates

```javascript
// Update multiple orders in single render
setOrders(prevOrders => {
  const updated = reconcileOrders(prevOrders, sheetOrders);
  return updated; // Single state update, single re-render
});
```

---

## SECURITY CONSIDERATIONS

### Input Validation

- All user inputs validated before storage
- Items string format verified: must include "x"
- Phone number validated: digits only, length >= 10
- Order ID: numeric only

### API Security

- Google Apps Script endpoint requires authentication
- Backend verifies requests before forwarding
- No sensitive data in logs

### Data Protection

- localStorage cleared after order placement
- sessionStorage used for temporary state
- No credentials stored locally

---

## MONITORING & LOGGING

### Log Levels

```
[Order] - Info level, order operations
[buildOrderPayload] - Info level, payload validation
[ConfirmPayment] - Info level, payment flow
[OrderSync] - Info level, sync operations
[OrderMonitor] - Info level, polling events

ERROR - Order items corrupted
ERROR - Duplicate order found
ERROR - Update failed (order not found)
ERROR - API timeout

WARN - Items format suspicious
WARN - Slow Google Sheets response
WARN - Missing customer name
```

### Metrics to Monitor

- Orders placed per hour
- Average status update time
- Polling cycle duration
- Ghost order detection rate
- Duplicate prevention success rate
- API response times (Google Sheets)

---

## FUTURE ENHANCEMENTS

1. **Real-time Sync (WebSocket)**
   - Replace 7s polling with push notifications
   - Reduce sync latency to <100ms

2. **Conflict Resolution**
   - Handle simultaneous edits to same order
   - Merge strategy with timestamps

3. **Audit Trail**
   - Log all mutations
   - Track who changed what, when

4. **Optimistic Updates**
   - Show changes immediately in UI
   - Confirm with backend async

5. **Offline Support**
   - Queue orders when offline
   - Sync when connection restored

---

