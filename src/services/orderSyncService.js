/**
 * Order Synchronization Service
 * 
 * Provides bidirectional synchronization between:
 * - Kitchen Panel ↔ Google Sheets
 * - Customer Display ↔ Google Sheets
 * - Frontend State ↔ Google Sheets
 * 
 * Google Sheets is the SINGLE SOURCE OF TRUTH
 * All displays reconcile against it every polling cycle
 */

const ORDERS_API_URL = process.env.REACT_APP_ORDERS_API_URL;
const MONITOR_ENDPOINT = process.env.REACT_APP_ORDERS_MONITOR_ENDPOINT || "/api/orders-monitor";

/**
 * Sync status update from Kitchen Panel to Google Sheet
 * CRITICAL: Only updates existing row, NEVER appends new row
 */
export async function syncStatusToSheet({ orderId, status, orderDate, timestamp }) {
  if (!orderId || !status) {
    throw new Error('orderId and status are required');
  }

  console.log('[OrderSync] Syncing status to sheet:', {
    orderId,
    status,
    orderDate,
    source: 'kitchen_panel',
  });

  try {
    const response = await fetch(MONITOR_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        orderId: String(orderId),
        status: String(status),
        timestamp: String(timestamp || new Date().toISOString()),
        orderDate: String(orderDate || new Date().toISOString().split('T')[0]),
        action: "updateOrderStatus",
        source: "kitchen_panel",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('[OrderSync] Status synced successfully:', { orderId, status, result });
    return result;
  } catch (error) {
    console.error('[OrderSync] Failed to sync status:', {
      orderId,
      status,
      error: error?.message,
    });
    throw error;
  }
}

/**
 * Fetch orders from Google Sheet and reconcile with frontend state
 * Treats Google Sheet as source of truth
 */
export async function fetchOrdersFromSheet({ date }) {
  try {
    const response = await fetch(MONITOR_ENDPOINT, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const orders = Array.isArray(data?.orders) ? data.orders : [];

    // Deduplicate by order ID, keeping latest timestamp
    const uniqueOrders = new Map();
    orders.forEach((order) => {
      const key = String(order?.orderId || order?.id);
      if (!key) return;

      const existing = uniqueOrders.get(key);
      if (!existing) {
        uniqueOrders.set(key, order);
      } else if (String(order?.timestamp || '') > String(existing?.timestamp || '')) {
        uniqueOrders.set(key, order);
      }
    });

    const dedupedOrders = Array.from(uniqueOrders.values());

    if (dedupedOrders.length < orders.length) {
      console.warn('[OrderSync] Deduplication occurred:', {
        before: orders.length,
        after: dedupedOrders.length,
        removed: orders.length - dedupedOrders.length,
      });
    }

    return dedupedOrders;
  } catch (error) {
    console.error('[OrderSync] Failed to fetch orders from sheet:', error?.message);
    throw error;
  }
}

/**
 * Detect orders that exist in frontend but not in Google Sheet
 * These are "ghost orders" that must be removed
 */
export function detectGhostOrders({
  frontendOrders,
  sheetOrders,
}) {
  const sheetOrderIds = new Set(
    sheetOrders.map((o) => String(o?.orderId || o?.id || '').trim()).filter(Boolean)
  );

  const ghostOrders = frontendOrders.filter(
    (o) => !sheetOrderIds.has(String(o?.orderId || o?.id || '').trim())
  );

  if (ghostOrders.length > 0) {
    console.warn('[OrderSync] Ghost orders detected:', {
      count: ghostOrders.length,
      ghostIds: ghostOrders.map((o) => o?.orderId || o?.id),
    });
  }

  return ghostOrders;
}

/**
 * Reconcile frontend state with Google Sheet
 * Removes ghost orders and updates statuses
 */
export function reconcileOrders({
  frontendOrders,
  sheetOrders,
}) {
  const ghostOrders = detectGhostOrders({ frontendOrders, sheetOrders });
  
  // Keep only orders that exist in sheet
  const validOrders = frontendOrders.filter(
    (fo) => !ghostOrders.some((go) => 
      String(fo?.orderId || fo?.id) === String(go?.orderId || go?.id)
    )
  );

  // Update statuses from sheet
  const reconciled = validOrders.map((fo) => {
    const sheetOrder = sheetOrders.find(
      (so) => String(so?.orderId || so?.id) === String(fo?.orderId || fo?.id)
    );

    if (!sheetOrder) {
      return fo;
    }

    // Merge sheet status and timestamp into frontend order
    const merged = {
      ...fo,
      status: sheetOrder?.status || fo?.status,
      timestamp: sheetOrder?.timestamp || fo?.timestamp,
      orderDate: sheetOrder?.orderDate || fo?.orderDate,
    };

    if (merged.status !== fo.status) {
      console.log('[OrderSync] Status updated from sheet:', {
        orderId: fo?.orderId,
        from: fo?.status,
        to: merged?.status,
      });
    }

    return merged;
  });

  return {
    reconciled,
    removed: ghostOrders.length,
    ghostOrderIds: ghostOrders.map((o) => o?.orderId || o?.id),
  };
}

/**
 * Validate order data integrity
 */
export function validateOrderIntegrity(order) {
  const issues = [];

  if (!order?.orderId && !order?.id) {
    issues.push('Missing orderId');
  }

  if (!order?.items || String(order.items).trim().length === 0) {
    issues.push('Missing or empty items');
  }

  if (order?.total === undefined || order?.total === null || Number(order.total) < 0) {
    issues.push('Invalid total');
  }

  if (!order?.customerName || String(order.customerName).trim().length === 0) {
    issues.push('Missing customerName');
  }

  if (issues.length > 0) {
    console.error('[OrderSync] Order integrity validation failed:', {
      orderId: order?.orderId || order?.id,
      issues,
      order,
    });
    return false;
  }

  return true;
}

/**
 * Monitor order changes from background polling
 * Used by Kitchen Panel and Customer Display
 */
export async function startOrderMonitoring({
  onOrdersChange,
  onGhostOrdersDetected,
  pollInterval = 7000,
  date,
}) {
  let lastOrders = [];
  let lastSheetOrders = [];

  const monitoringInterval = setInterval(async () => {
    try {
      const sheetOrders = await fetchOrdersFromSheet({ date });
      
      // Detect changes
      const sheetOrderIds = new Set(
        sheetOrders.map((o) => String(o?.orderId || o?.id).trim())
      );
      const lastOrderIds = new Set(
        lastOrders.map((o) => String(o?.orderId || o?.id).trim())
      );

      const newOrders = sheetOrders.filter(
        (o) => !lastOrderIds.has(String(o?.orderId || o?.id).trim())
      );
      const removedOrders = lastOrders.filter(
        (o) => !sheetOrderIds.has(String(o?.orderId || o?.id).trim())
      );
      const updatedOrders = sheetOrders.filter((so) => {
        const lo = lastOrders.find(
          (o) => String(o?.orderId || o?.id) === String(so?.orderId || so?.id)
        );
        return lo && so?.status !== lo?.status;
      });

      if (newOrders.length > 0 || removedOrders.length > 0 || updatedOrders.length > 0) {
        console.log('[OrderMonitor] Changes detected:', {
          new: newOrders.length,
          removed: removedOrders.length,
          updated: updatedOrders.length,
        });

        if (removedOrders.length > 0 && onGhostOrdersDetected) {
          onGhostOrdersDetected(removedOrders);
        }

        if (onOrdersChange) {
          onOrdersChange(sheetOrders);
        }
      }

      lastOrders = sheetOrders;
      lastSheetOrders = sheetOrders;
    } catch (error) {
      console.error('[OrderMonitor] Polling failed:', error?.message);
    }
  }, pollInterval);

  return () => clearInterval(monitoringInterval);
}

export default {
  syncStatusToSheet,
  fetchOrdersFromSheet,
  detectGhostOrders,
  reconcileOrders,
  validateOrderIntegrity,
  startOrderMonitoring,
};
