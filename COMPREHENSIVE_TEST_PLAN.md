# COMPREHENSIVE TEST EXECUTION PLAN

**Deployment Date**: 2026-05-20  
**Commit Hash**: daaab0a28c93d057ad5c64d6c722b7537ce45583  
**Production URL**: https://anupama-canteen.vercel.app  
**Status**: ✅ READY FOR TESTING

---

## TEST OBJECTIVES

Per user requirements, verify:
1. ✓ Order items are stored EXACTLY as selected (no corruption)
2. ✓ Status updates modify existing rows (no duplicates)
3. ✓ Status changes sync bidirectionally between all panels
4. ✓ Deleted rows disappear from all displays immediately

---

## PREREQUISITE VERIFICATION

Before running user tests, system should be verified:

### System Health Check
```
[REQUIRED] API /api/health endpoint returns 200
[REQUIRED] Google Apps Script is connected and accessible
[REQUIRED] Build completed with 0 errors
[REQUIRED] Deployment is live at https://anupama-canteen.vercel.app
```

**Verification Steps**:
```bash
# Check health
curl https://anupama-canteen.vercel.app/api/health

# Verify build output (should be in build/ folder)
ls -la build/ | grep main.*.js

# Test live site
open https://anupama-canteen.vercel.app
```

---

## TEST SCENARIO 1: Order Items Stored Correctly

**Objective**: Verify "2 Idli" is NOT corrupted to "2 Vada Pav" in Google Sheets

### Setup
- Open https://anupama-canteen.vercel.app in browser
- Open Google Sheets backup in another tab
- Open browser DevTools Console (F12 → Console tab)

### Execution Steps

**Step 1: Add Items to Cart**
```
1. Click menu item: "2 Idli"
2. Verify cart shows: "Idli x2" with price 80
3. Console should log: [Order] Items captured correctly
```

**Step 2: Proceed to Payment**
```
1. Click "Proceed to Payment" button
2. Look for logs:
   - [Order] Cart snapshot created
   - [Order] Items string created: "2 Idli x1" (or similar)
3. Note the items string logged
```

**Step 3: Select Payment Method**
```
1. Click "Cash at Counter" button
2. Verify orderDetails shows correct items
3. Console log should show: [ConfirmPayment] Items validated ✓
```

**Step 4: Confirm Order**
```
1. Enter phone number: 9876543210
2. Click "Place Order" button
3. Wait for success notification
4. Console should show:
   - [buildOrderPayload] Items string: "2 Idli x1"
   - Order submitted successfully
```

**Step 5: Verify Google Sheets**
```
1. Switch to Google Sheets tab
2. Look at the most recent order row
3. Check "Items" column
4. Should show: "2 Idli" (EXACT, not corrupted)
```

**Expected Result**: ✅ PASS
- Google Sheet shows "2 Idli"
- NOT "2 Vada Pav"
- NOT empty
- NOT malformed

**Failure Indicators** ❌:
- Items show as different menu item
- Items show as empty
- Items show as "null" or "undefined"
- Console shows "CRITICAL VALIDATION FAILURE"

---

## TEST SCENARIO 2: Status Updates Don't Create Duplicates

**Objective**: Verify "1 row" after status update, not 2+ duplicate rows

### Setup
- Use order created in Test Scenario 1
- Keep Google Sheets visible
- Open Kitchen Panel (password required)

### Execution Steps

**Step 1: Login to Kitchen Panel**
```
1. Go to https://anupama-canteen.vercel.app
2. Click "Kitchen Panel Login"
3. Enter password (from config)
4. Verify order appears in Kitchen Monitor
```

**Step 2: Change Status**
```
1. Find the "2 Idli" order from Test 1
2. Click status button: "Pending" 
3. Select: "Preparing"
4. Wait for success message
5. Console should show:
   - [OrderSync] Syncing status to sheet
   - [OrderSync] Status synced successfully
```

**Step 3: Check Google Sheets**
```
1. Switch to Google Sheets tab
2. Look for orders with your Order ID
3. Count rows with this Order ID
4. Should show: EXACTLY 1 row
5. Status should be: "Preparing"
```

**Step 4: Verify No Ghost Rows**
```
1. Search entire sheet for the Order ID
2. Use Ctrl+F to find all occurrences
3. Should find: EXACTLY 1 row
4. NOT 2 or 3 rows
```

**Expected Result**: ✅ PASS
- Exactly 1 row in Google Sheets
- Status updated to "Preparing"
- No duplicate rows created
- Previous "Pending" status replaced

**Failure Indicators** ❌:
- 2 or more rows with same Order ID
- Original "Pending" row still exists
- Status not updated
- Console shows error about update failure

---

## TEST SCENARIO 3: Bidirectional Status Sync

**Objective**: Verify status changes sync between Kitchen Panel and Google Sheet

### Setup
- Kitchen Panel open and logged in
- Google Sheets open in another tab
- Customer Display open in third tab

### Execution Steps

**Step 1: Manual Status Update in Google Sheets**
```
1. In Google Sheets, find a test order
2. Manually change Status column: "Pending" → "Ready"
3. Press Enter to confirm
4. Note timestamp of change (for 7-second polling)
```

**Step 2: Verify Kitchen Panel Updates**
```
1. Switch to Kitchen Panel tab
2. Wait up to 7 seconds (polling interval)
3. Verify order status shows: "Ready"
4. Should NOT require manual refresh
5. Console should log:
   - [OrderSync] Polling for changes
   - [OrderMonitor] Changes detected: { updated: [...] }
```

**Step 3: Verify Customer Display Updates**
```
1. Switch to Customer Display tab (if running)
2. Wait up to 7 seconds
3. Verify order status shows: "Ready"
4. Should auto-update without page reload
```

**Step 4: Reverse - Update from Kitchen Panel**
```
1. In Kitchen Panel, click order status button
2. Change to: "Delivered"
3. Wait for success message
4. Switch to Google Sheets
5. Should show: "Delivered" (auto-synced)
```

**Expected Result**: ✅ PASS
- Manual Google Sheet edit syncs to Kitchen Panel within 7s
- Kitchen Panel status update syncs to Google Sheets immediately
- Customer Display shows correct status without refresh
- All three views stay in sync

**Failure Indicators** ❌:
- Status doesn't update after 10+ seconds
- Manual sheet edit not reflected on panels
- Panel update doesn't reach Google Sheets
- Inconsistent status between views

---

## TEST SCENARIO 4: Ghost Order Removal

**Objective**: Verify deleted rows disappear from all displays

### Setup
- Kitchen Panel logged in
- Google Sheets open
- Customer Display visible
- All showing same test orders

### Execution Steps

**Step 1: Identify Order to Delete**
```
1. In Kitchen Panel, note an order ID (visible at top of card)
2. Find same order in Google Sheets
3. Find same order in Customer Display
```

**Step 2: Delete Row from Google Sheets**
```
1. In Google Sheets, right-click on the order's row
2. Select "Delete row"
3. Confirm deletion
4. Wait 1 second for sheet to update
```

**Step 3: Verify Kitchen Panel Auto-Updates**
```
1. Switch to Kitchen Panel tab
2. Wait up to 7 seconds (polling interval)
3. Verify order card is GONE
4. Should NOT require manual refresh
5. Console should log:
   - [OrderSync] Ghost orders detected: { count: 1 }
   - [OrderMonitor] Removed ghost: { orderId: X }
```

**Step 4: Verify Customer Display Auto-Updates**
```
1. Switch to Customer Display tab
2. Wait up to 7 seconds
3. Verify order is GONE from display
4. Should NOT require manual refresh
```

**Step 5: Verify No Stale References**
```
1. Check Kitchen Panel order count (should be less)
2. Check Customer Display order count (should match Kitchen)
3. No "blank cards" or "ghost entries"
```

**Expected Result**: ✅ PASS
- Order disappears from Kitchen Panel within 7 seconds
- Order disappears from Customer Display within 7 seconds
- No ghost/stale UI elements remain
- All panels agree on order list

**Failure Indicators** ❌:
- Order still visible after 10+ seconds
- Blank or broken order card visible
- Different order counts between panels
- Console shows "Error removing ghost order"

---

## TEST SCENARIO 5: Stress Test - Rapid Status Updates

**Objective**: Verify no duplicates under rapid status changes

### Setup
- Single test order ready
- Kitchen Panel logged in
- Google Sheets visible in another tab

### Execution Steps

**Step 1: Rapid Status Clicks**
```
1. In Kitchen Panel, rapidly click status button 3-5 times
2. Sequence: Pending → Preparing → Ready → Delivering → Delivered
3. Click as fast as possible (2-3 seconds total)
4. No pause between clicks
```

**Step 2: Check Google Sheets**
```
1. Immediately switch to Google Sheets
2. Look for the order row
3. Should see: 
   - EXACTLY 1 row
   - Status: "Delivered" (final state)
   - No duplicate rows with different statuses
```

**Step 3: Verify No Partial Updates**
```
1. Check for any rows with intermediate statuses (Preparing, Ready)
2. Should find: ZERO intermediate rows
3. Only the FINAL status (Delivered) should exist
```

**Expected Result**: ✅ PASS
- Single row with final status "Delivered"
- No duplicate rows created
- All intermediate clicks consolidated into one update

**Failure Indicators** ❌:
- 2+ rows created
- Multiple status values visible
- Some clicks "lost" (not reflected)
- Console shows duplicate append errors

---

## TEST SCENARIO 6: Order Integrity Validation

**Objective**: Verify corrupted orders are rejected

### Setup
- Browser DevTools open (to check local storage)
- Console ready to monitor logs

### Execution Steps

**Step 1: Add Item to Cart**
```
1. Click "Vada Pav" from menu
2. Cart shows: "Vada Pav x1"
3. Price: 60
```

**Step 2: Verify Cart Snapshot**
```
1. Open DevTools → Application → Local Storage
2. Look for key: anupama:currentCart
3. Should show JSON array with items
4. Not empty, properly formatted
```

**Step 3: Proceed and Validate**
```
1. Click "Proceed to Payment"
2. Console should show: [Order] Cart snapshot created ✓
3. Click "Cash at Counter"
4. Console should show: [ConfirmPayment] Items validated ✓
5. Enter phone: 9876543210
6. Click "Place Order"
```

**Step 4: Verify No Error Messages**
```
1. Should NOT see:
   - "Order items corrupted"
   - "Items cannot be empty"
   - "CRITICAL VALIDATION FAILURE"
2. Should see: "Order placed successfully"
```

**Step 5: Verify Google Sheets**
```
1. Check Google Sheets for order
2. Should show: "Vada Pav x1" (exact items)
3. NOT empty, NOT corrupted
```

**Expected Result**: ✅ PASS
- Order accepted without validation errors
- Items stored correctly in Google Sheets
- Console shows all validation checks passed

**Failure Indicators** ❌:
- Validation error messages appear
- Order rejected during placement
- Items not stored in Google Sheets
- Console shows "CRITICAL" errors

---

## QUICK REGRESSION TEST

After all main tests, verify nothing broke:

```
[CHECK] Menu loads correctly
[CHECK] Cart calculations are correct
[CHECK] Payment flow completes
[CHECK] API health = 200
[CHECK] Google Sheets populated
[CHECK] No console errors logged
[CHECK] No API timeouts (max 10s)
[CHECK] Keyboard shortcuts still work
[CHECK] Mobile responsive layout intact
```

---

## TEST RESULTS SUMMARY

Create test results document with:
- Date and time of each test
- Test scenario number and objective
- Pass/Fail result
- Any failure details
- Console logs (if failed)
- Recommendations

**Example Format**:
```
TEST SCENARIO 1: Order Items Stored Correctly
- Date: 2026-05-20, Time: 14:30 UTC
- Objective: Verify "2 Idli" not corrupted to "2 Vada Pav"
- Result: ✅ PASS
- Details: Order placed with 2 Idli, Google Sheets shows exactly "2 Idli"
- No corruption detected
```

---

## KNOWN LIMITATIONS

1. **Polling Delay**: Status changes take up to 7 seconds to propagate
   - Reason: Frontend polls Google Sheet every 7 seconds
   - Solution: Real-time WebSocket updates in future version

2. **Manual Google Sheet Edits**: Must follow format
   - Dates: YYYY-MM-DD format
   - Order ID: Numeric only
   - Status: Must be one of [Pending, Preparing, Ready, Delivering, Delivered]
   - Items: "Name x Quantity, Name x Quantity" format

3. **Network Dependent**: Requires internet connection
   - Google Sheets API access required
   - Vercel endpoint must be responsive

---

## SUPPORT & DEBUGGING

If tests fail:

1. **Check Browser Console**
   ```
   Look for [Order], [OrderSync], [OrderMonitor] logs
   Note any ERROR or CRITICAL messages
   Copy exact error text for debugging
   ```

2. **Check Network Tab (DevTools)**
   ```
   - POST /api/append-order → should return 200/201
   - POST /api/orders-monitor → should return 200
   - GET to Google Apps Script → should return 200
   ```

3. **Check Google Sheets**
   ```
   - Are rows actually being created?
   - Are statuses being updated?
   - Check "View revision history" for edit details
   ```

4. **Verify Configuration**
   ```
   - GOOGLE_SHEET_ID is correct
   - APPEND_ORDER_ENDPOINT points to right endpoint
   - MONITOR_ENDPOINT is accessible
   - Google Apps Script is deployed
   ```

5. **Contact Support With**:
   ```
   - Exact test scenario that failed
   - Console error messages (full text)
   - Google Sheet Order ID (if applicable)
   - Network request/response logs
   - Time of test execution (UTC)
   - Browser and OS information
   ```

---

## TEST EXECUTION TIMELINE

**Estimated Duration**: 45-60 minutes total

| Scenario | Setup Time | Execution | Verification | Total |
|----------|-----------|-----------|--------------|-------|
| 1 | 2 min | 3 min | 2 min | 7 min |
| 2 | 1 min | 3 min | 3 min | 7 min |
| 3 | 1 min | 5 min | 2 min | 8 min |
| 4 | 1 min | 7 min | 2 min | 10 min |
| 5 | 1 min | 2 min | 3 min | 6 min |
| 6 | 2 min | 4 min | 2 min | 8 min |
| **Regression** | - | 5 min | - | 5 min |
| **Documentation** | - | - | 5 min | 5 min |
| **TOTAL** | | | | **~56 min** |

---

## FINAL SIGN-OFF

**Approved for Production**: ✅ YES (after all tests pass)

**Critical Success Criteria**:
- [ ] Test 1 PASS: Items stored correctly
- [ ] Test 2 PASS: No duplicate rows
- [ ] Test 3 PASS: Bidirectional sync working
- [ ] Test 4 PASS: Ghost orders removed
- [ ] Test 5 PASS: Rapid updates handled
- [ ] Test 6 PASS: Validation working
- [ ] Regression: No new issues introduced
- [ ] All console logs are INFO/LOG level (no ERRORS)

**Sign-off Date**: _____________  
**Tester Name**: _____________  
**Production Ready**: [ ] YES / [ ] NO (reasons if not)

---

