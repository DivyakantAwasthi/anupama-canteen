const CONFIG = {
  ORDERS_SHEET: 'SnackOrders',
  DASHBOARD_SHEET: 'Dashboard',
  ADMIN_SHEET: 'AdminOrders',
  ANALYTICS_SHEET: 'Analytics',
  MENU_SHEET: 'Menu',
  BACKUP_PREFIX: 'SnackOrders_Backup_',
  TIME_ZONE: 'Asia/Kolkata',
  DATE_FORMAT: 'yyyy-MM-dd',
  HEADERS: [
    'orderId',
    'orderDate',
    'customerName',
    'customerEmail',
    'customerPhone',
    'items',
    'total',
    'status',
    'timestamp',
  ],
  STATUSES: [
    'pending_payment',
    'payment_verified',
    'preparing',
    'ready_for_pickup',
    'delivered',
    'cancelled',
  ],
  STATUS_COLORS: {
    pending_payment: '#dc2626',
    payment_verified: '#f59e0b',
    preparing: '#2563eb',
    ready_for_pickup: '#16a34a',
    delivered: '#6b7280',
    cancelled: '#7f1d1d',
  },
};

function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Anupama POS')
    .addItem('Refresh workbook design', 'refreshWorkbookDesign')
    .addSeparator()
    .addItem("Today's Orders", 'showTodaysOrders')
    .addItem('Pending Orders', 'showPendingOrders')
    .addItem('Preparing Orders', 'showPreparingOrders')
    .addItem('Ready Orders', 'showReadyOrders')
    .addItem('Delivered Orders', 'showDeliveredOrders')
    .addItem('Clear Order Filters', 'clearOrderFilters')
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() === CONFIG.ORDERS_SHEET && e.range.getRow() > 1 && e.range.getColumn() === 8) {
    setupWorkbook_({ backup: false });
    updateDashboardAndAnalytics_();
    rebuildAdminSheet_();
    return;
  }
  if (sheet.getName() === CONFIG.ADMIN_SHEET && e.range.getRow() > 4 && e.range.getColumn() === 8) {
    const orderId = String(sheet.getRange(e.range.getRow(), 1).getValue() || '').trim();
    const status = normalizeStatus_(e.value);
    if (orderId && status) {
      updateOrderStatus_({ orderId, status });
      rebuildAdminSheet_();
    }
    return;
  }
  if (sheet.getName() === CONFIG.ADMIN_SHEET && e.range.getRow() === 2 && e.range.getColumn() >= 2 && e.range.getColumn() <= 4) {
    rebuildAdminSheet_();
  }
}

function handleRequest_(e, method) {
  try {
    const params = getParams_(e);
    const action = String(params.action || (method === 'POST' ? 'appendOrder' : 'menu')).trim();
    if (['menu', 'getMenu', 'listMenu'].indexOf(action) !== -1) {
      return json_({ ok: true, items: getMenuItems_() });
    }
    if (action === 'setup') {
      setupWorkbook_({ backup: false, force: true });
      return json_({ ok: true, message: 'Workbook setup complete.' });
    }
    if (action === 'migrate') {
      setupWorkbook_({ backup: true, migrate: true, force: true });
      return json_({ ok: true, message: 'Migration complete. Backup sheet created.' });
    }
    setupWorkbook_({ backup: false });
    if (['appendOrder', 'addOrder', 'createOrder'].indexOf(action) !== -1) {
      return json_(appendOrder_(params));
    }
    if (['listOrders', 'getOrders', 'orders', 'recentOrders', 'kitchenOrders'].indexOf(action) !== -1) {
      return json_({ ok: true, orders: listOrders_(params) });
    }
    if (['trackOrder', 'track', 'orderStatus'].indexOf(action) !== -1) {
      const order = trackOrder_(params);
      return json_(order ? { ok: true, order } : { ok: false, error: 'order_not_found' });
    }
    if (['updateOrderStatus', 'setOrderStatus', 'updateStatus'].indexOf(action) !== -1) {
      return json_(updateOrderStatus_(params));
    }

    return json_({ ok: false, error: 'unknown_action', action });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function getParams_(e) {
  const params = Object.assign({}, (e && e.parameter) || {});
  const postData = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!postData) return params;

  const type = String((e.postData && e.postData.type) || '').toLowerCase();
  if (type.indexOf('application/json') !== -1) {
    try {
      return Object.assign(params, JSON.parse(postData));
    } catch (error) {
      return params;
    }
  }

  postData.split('&').forEach(function (part) {
    const pieces = part.split('=');
    if (!pieces[0]) return;
    params[decodeURIComponent(pieces[0].replace(/\+/g, ' '))] = decodeURIComponent(
      (pieces.slice(1).join('=') || '').replace(/\+/g, ' ')
    );
  });
  return params;
}

function setupWorkbook_(options) {
  const opts = options || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orders = getOrCreateSheet_(ss, CONFIG.ORDERS_SHEET);

  ensureHeaders_(orders);
  if (opts.backup) backupOrdersSheet_(ss, orders);
  if (opts.migrate) migrateOrdersSheet_(orders);
  applyOrderSheetFormatting_(orders);
  ensureDashboardSheet_(ss);
  ensureAnalyticsSheet_(ss);
  formatMenuSheet_(ss);
  rebuildAdminSheet_();
  updateDashboardAndAnalytics_();
}

function refreshWorkbookDesign() {
  setupWorkbook_({ backup: false, force: true });
}

function showTodaysOrders() {
  applyOrderQuickFilter_({ date: todayKey_() });
}

function showPendingOrders() {
  applyOrderQuickFilter_({ statuses: ['pending_payment', 'payment_verified'] });
}

function showPreparingOrders() {
  applyOrderQuickFilter_({ statuses: ['preparing'] });
}

function showReadyOrders() {
  applyOrderQuickFilter_({ statuses: ['ready_for_pickup'] });
}

function showDeliveredOrders() {
  applyOrderQuickFilter_({ statuses: ['delivered'] });
}

function clearOrderFilters() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ORDERS_SHEET);
  if (!sheet) return;
  const filter = sheet.getFilter();
  if (!filter) return;
  for (let col = 1; col <= CONFIG.HEADERS.length; col += 1) {
    filter.removeColumnFilterCriteria(col);
  }
}

function applyOrderQuickFilter_(options) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ORDERS_SHEET);
  if (!sheet) return;
  applyOrderSheetFormatting_(sheet);
  const filter = sheet.getFilter();
  if (!filter) return;
  const opts = options || {};
  if (opts.date) {
    filter.setColumnFilterCriteria(2, SpreadsheetApp.newFilterCriteria().whenTextEqualTo(opts.date).build());
  }
  if (opts.statuses && opts.statuses.length) {
    const hiddenStatuses = CONFIG.STATUSES.filter(function (status) {
      return opts.statuses.indexOf(status) === -1;
    });
    filter.setColumnFilterCriteria(8, SpreadsheetApp.newFilterCriteria().setHiddenValues(hiddenStatuses).build());
  }
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders_(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).getValues()[0];
  const hasHeader = CONFIG.HEADERS.every(function (header, index) {
    return String(firstRow[index] || '').trim() === header;
  });
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
  }
}

function backupOrdersSheet_(ss, orders) {
  const name = CONFIG.BACKUP_PREFIX + Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyyMMdd_HHmmss');
  const backup = orders.copyTo(ss).setName(name);
  backup.hideSheet();
}

function migrateOrdersSheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return;

  const cleaned = [CONFIG.HEADERS];
  let currentDate = '';
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i].slice(0, CONFIG.HEADERS.length);
    if (isBlankRow_(row)) continue;

    const firstCell = String(row[0] || '').trim().toUpperCase();
    if (firstCell === 'DATE') {
      currentDate = normalizeDate_(row[1]) || currentDate;
      continue;
    }

    if (!row[1] && currentDate) row[1] = currentDate;
    row[1] = normalizeDate_(row[1]) || normalizeDate_(row[8]) || todayKey_();
    row[7] = normalizeStatus_(row[7]) || 'pending_payment';
    cleaned.push(row);
  }

  sheet.clear();
  sheet.getRange(1, 1, cleaned.length, CONFIG.HEADERS.length).setValues(cleaned);
  removeExtraRowsAndColumns_(sheet, cleaned.length, CONFIG.HEADERS.length);
}

function removeExtraRowsAndColumns_(sheet, rowCount, columnCount) {
  const maxRows = sheet.getMaxRows();
  if (maxRows > rowCount) sheet.deleteRows(rowCount + 1, maxRows - rowCount);
  const maxColumns = sheet.getMaxColumns();
  if (maxColumns > columnCount) sheet.deleteColumns(columnCount + 1, maxColumns - columnCount);
}

function isBlankRow_(row) {
  return row.every(function (value) {
    return String(value || '').trim() === '';
  });
}

function appendOrder_(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ORDERS_SHEET);
  const timestamp = normalizeTimestamp_(params.timestamp);
  const orderDate = normalizeDate_(params.orderDate || params.orderDateKey || params.date || timestamp) || todayKey_();
  const incomingOrderId = String(params.orderId || params.id || '').trim();
  const existing = incomingOrderId ? findOrderRow_(incomingOrderId, orderDate) : null;
  if (existing) {
    return { ok: true, duplicate: true, orderId: existing.order.orderId, order: existing.order };
  }

  const candidateOrder = {
    orderId: '',
    orderDate: orderDate,
    customerName: clean_(params.customerName || params.name),
    customerEmail: clean_(params.customerEmail || params.email),
    customerPhone: clean_(params.customerPhone || params.phone),
    items: clean_(params.items),
    total: Number(params.total || 0),
    status: normalizeStatus_(params.status || params.orderStatus) || 'pending_payment',
    timestamp: timestamp,
  };
  const duplicate = findDuplicateOrder_(candidateOrder);
  if (duplicate) {
    return { ok: true, duplicate: true, orderId: duplicate.order.orderId, order: duplicate.order };
  }

  candidateOrder.orderId = isProfessionalOrderId_(incomingOrderId)
    ? incomingOrderId
    : nextProfessionalOrderId_(sheet, orderDate);

  validateOrder_(candidateOrder);
  sheet.appendRow(CONFIG.HEADERS.map(function (key) { return candidateOrder[key]; }));
  applyOrderSheetFormatting_(sheet);
  updateDashboardAndAnalytics_();
  rebuildAdminSheet_();
  return { ok: true, orderId: candidateOrder.orderId, order: candidateOrder };
}

function validateOrder_(order) {
  if (!order.customerName) throw new Error('missing_customerName');
  if (!order.customerPhone) throw new Error('missing_customerPhone');
  if (!order.items) throw new Error('missing_items');
  if (!CONFIG.STATUSES.includes(order.status)) throw new Error('invalid_status');
}

function nextProfessionalOrderId_(sheet, orderDate) {
  const ymd = orderDate.replace(/-/g, '');
  const values = sheet.getDataRange().getValues();
  let max = 0;
  const pattern = new RegExp('^AC-' + ymd + '-(\\d{3,})$');
  for (let i = 1; i < values.length; i += 1) {
    const rowDate = normalizeDate_(values[i][1]) || normalizeDate_(values[i][8]);
    if (rowDate !== orderDate) continue;
    const id = String(values[i][0] || '').trim();
    const match = id.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return 'AC-' + ymd + '-' + String(max + 1).padStart(3, '0');
}

function isProfessionalOrderId_(value) {
  return /^AC-\d{8}-\d{3,}$/i.test(String(value || '').trim());
}

function listOrders_(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ORDERS_SHEET);
  const data = rowsToObjects_(sheet);
  const date = normalizeDate_(params.orderDate || params.date || '');
  const limit = Math.max(1, Math.min(Number(params.limit || 100), 500));
  return data
    .filter(function (order) { return !date || order.orderDate === date; })
    .sort(function (a, b) { return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(); })
    .slice(0, limit);
}

function trackOrder_(params) {
  const orderId = String(params.orderId || params.id || '').trim();
  if (!orderId) return null;
  const date = normalizeDate_(params.orderDate || params.date || '');
  const found = findOrderRow_(orderId, date);
  return found ? found.order : null;
}

function updateOrderStatus_(params) {
  const orderId = String(params.orderId || params.id || '').trim();
  const status = normalizeStatus_(params.status || params.orderStatus);
  const date = normalizeDate_(params.orderDate || params.date || '');
  console.log('[AppsScript:updateOrderStatus] Received request', { orderId: orderId, status: status, date: date });
  if (!orderId || !status) throw new Error('invalid_status_payload');

  const found = findOrderRow_(orderId, date);
  if (!found) {
    console.log('[AppsScript:updateOrderStatus] Order row not found', { orderId: orderId, date: date });
    return { ok: false, error: 'order_not_found', orderId: orderId };
  }

  console.log('[AppsScript:updateOrderStatus] Updating sheet row', { rowIndex: found.rowIndex, orderId: orderId, status: status });
  found.sheet.getRange(found.rowIndex, 8).setValue(status);
  applyOrderSheetFormatting_(found.sheet);
  updateDashboardAndAnalytics_();
  rebuildAdminSheet_();

  console.log('[AppsScript:updateOrderStatus] Update completed', { rowIndex: found.rowIndex, orderId: orderId, status: status });
  return { ok: true, orderId: orderId, status: status };
}

function findOrderRow_(orderId, orderDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ORDERS_SHEET);
  const values = sheet.getDataRange().getValues();
  console.log('[AppsScript:findOrderRow] Searching for order', { orderId: orderId, orderDate: orderDate, rows: values.length - 1 });
  for (let i = 1; i < values.length; i += 1) {
    const rowOrderId = String(values[i][0] || '').trim();
    const rowDate = normalizeDate_(values[i][1]) || normalizeDate_(values[i][8]);
    if (rowOrderId === String(orderId).trim() && (!orderDate || rowDate === orderDate)) {
      console.log('[AppsScript:findOrderRow] Found match', { rowIndex: i + 1, rowOrderId: rowOrderId, rowDate: rowDate });
      return { sheet: sheet, rowIndex: i + 1, order: rowToObject_(values[i]) };
    }
  }
  console.log('[AppsScript:findOrderRow] No matching row found', { orderId: orderId, orderDate: orderDate });
  return null;
}

function findDuplicateOrder_(candidate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ORDERS_SHEET);
  const values = sheet.getDataRange().getValues();
  const candidateTime = new Date(candidate.timestamp).getTime();
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][0] || '').trim().toUpperCase() === 'DATE') continue;
    const order = rowToObject_(values[i]);
    const orderTime = new Date(order.timestamp).getTime();
    const sameTimestamp =
      !isNaN(candidateTime) &&
      !isNaN(orderTime) &&
      Math.abs(orderTime - candidateTime) <= 1000;
    if (
      order.orderDate === candidate.orderDate &&
      order.customerPhone === candidate.customerPhone &&
      String(order.items || '') === String(candidate.items || '') &&
      Number(order.total || 0).toFixed(2) === Number(candidate.total || 0).toFixed(2) &&
      sameTimestamp
    ) {
      return { sheet: sheet, rowIndex: i + 1, order: order };
    }
  }
  return null;
}

function rowsToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  return values.slice(1).filter(function (row) {
    return !isBlankRow_(row) && String(row[0] || '').trim().toUpperCase() !== 'DATE';
  }).map(rowToObject_);
}

function rowToObject_(row) {
  const obj = {};
  CONFIG.HEADERS.forEach(function (key, index) {
    obj[key] = row[index];
  });
  obj.orderId = String(obj.orderId || '').trim();
  obj.orderDate = normalizeDate_(obj.orderDate) || normalizeDate_(obj.timestamp);
  obj.customerPhone = String(obj.customerPhone || '').trim();
  obj.total = Number(obj.total || 0);
  obj.status = normalizeStatus_(obj.status) || 'pending_payment';
  obj.timestamp = obj.timestamp instanceof Date ? obj.timestamp.toISOString() : String(obj.timestamp || '');
  return obj;
}

function applyOrderSheetFormatting_(sheet) {
  ensureHeaders_(sheet);
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = CONFIG.HEADERS.length;
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  sheet.getRange(1, 1, 1, lastCol)
    .setFontFamily('Segoe UI')
    .setFontWeight('bold')
    .setFontSize(10)
    .setFontColor('#ffffff')
    .setBackground('#0f2a44')
    .setHorizontalAlignment('center');
  sheet.setRowHeight(1, 34);
  if (lastRow > 1) sheet.setRowHeights(2, lastRow - 1, 36);
  sheet.getRange(1, 1, lastRow, lastCol)
    .setFontFamily('Segoe UI')
    .setFontSize(10)
    .setWrap(true)
    .setVerticalAlignment('middle')
    .setBorder(false, false, false, false, false, false);
  sheet.getRange(2, 1, Math.max(lastRow - 1, 1), 1).setFontWeight('bold').setFontColor('#0f2a44');
  sheet.getRange(2, 3, Math.max(lastRow - 1, 1), 1).setFontWeight('bold');
  sheet.getRange(2, 4, Math.max(lastRow - 1, 1), 1).setFontColor('#64748b');
  sheet.getRange(2, 6, Math.max(lastRow - 1, 1), 1).setWrap(true);
  sheet.getRange(1, 7, lastRow, 1).setNumberFormat('"Rs." #,##0.00').setHorizontalAlignment('right');
  sheet.getRange(1, 8, lastRow, 1).setHorizontalAlignment('center').setFontWeight('bold');
  sheet.getRange(1, 9, lastRow, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(1, 1, lastRow, lastCol).createFilter();
  applyStatusValidation_(sheet, 2, Math.max(lastRow - 1, 1));
  applyAlternatingColors_(sheet, lastRow, lastCol);
  applyStatusColors_(sheet, 2);
  applyTodayHighlight_(sheet, 2);
  applyOrderColumnWidths_(sheet);
}

function applyStatusValidation_(sheet, startRow, rows) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.STATUSES, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(startRow, 8, Math.max(rows, 1), 1).setDataValidation(rule);
}

function applyStatusColors_(sheet, startRow) {
  const firstRow = startRow || 2;
  const rules = sheet.getConditionalFormatRules().filter(function (rule) {
    return !rule.getRanges().some(function (range) {
      return range.getColumn() === 8 ||
        (range.getColumn() === 1 && range.getNumColumns() === CONFIG.HEADERS.length);
    });
  });
  CONFIG.STATUSES.forEach(function (status) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(status)
      .setBackground(CONFIG.STATUS_COLORS[status])
      .setFontColor('#ffffff')
      .setBold(true)
      .setRanges([sheet.getRange(firstRow, 8, Math.max(sheet.getMaxRows() - firstRow + 1, 1), 1)])
      .build());
  });
  sheet.setConditionalFormatRules(rules);
}

function applyAlternatingColors_(sheet, lastRow, lastCol) {
  sheet.getBandings().forEach(function (banding) { banding.remove(); });
  if (lastRow > 1) {
    const banding = sheet.getRange(1, 1, lastRow, lastCol).applyRowBanding();
    banding
      .setHeaderRowColor('#0f2a44')
      .setFirstRowColor('#ffffff')
      .setSecondRowColor('#f8fafc');
  }
}

function applyTodayHighlight_(sheet, startRow) {
  const firstRow = startRow || 2;
  const rowCount = Math.max(sheet.getMaxRows() - firstRow + 1, 1);
  const formulaRow = firstRow;
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$B' + formulaRow + '=TEXT(TODAY(),"yyyy-mm-dd")')
    .setBackground('#fff7ed')
    .setRanges([sheet.getRange(firstRow, 1, rowCount, CONFIG.HEADERS.length)])
    .build();
  const rules = sheet.getConditionalFormatRules();
  rules.push(rule);
  sheet.setConditionalFormatRules(rules);
}

function applyOrderColumnWidths_(sheet) {
  sheet.setColumnWidth(1, 128);
  sheet.setColumnWidth(2, 112);
  sheet.setColumnWidth(3, 170);
  sheet.setColumnWidth(4, 190);
  sheet.setColumnWidth(5, 128);
  sheet.setColumnWidth(6, 320);
  sheet.setColumnWidth(7, 110);
  sheet.setColumnWidth(8, 154);
  sheet.setColumnWidth(9, 160);
}

function ensureDashboardSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.DASHBOARD_SHEET);
  sheet.clear();
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(1);
  sheet.getRange('A1:H1').merge().setValue('Anupama Canteen Operations Dashboard');
  sheet.getRange('A1:H1')
    .setFontFamily('Segoe UI')
    .setFontWeight('bold')
    .setFontSize(18)
    .setFontColor('#ffffff')
    .setBackground('#0f2a44')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 42);
  sheet.getRange('A2:H2').merge().setValue('Live management view powered by SnackOrders');
  sheet.getRange('A2:H2').setFontFamily('Segoe UI').setFontColor('#64748b').setFontSize(10).setHorizontalAlignment('center');

  const cards = [
    ['A3:B3', 'A4:B5', "Today's Orders", '=COUNTIF(SnackOrders!B:B,TEXT(TODAY(),"yyyy-mm-dd"))'],
    ['C3:D3', 'C4:D5', "Today's Revenue", '=SUMIF(SnackOrders!B:B,TEXT(TODAY(),"yyyy-mm-dd"),SnackOrders!G:G)'],
    ['E3:F3', 'E4:F5', 'Pending Orders', '=COUNTIF(SnackOrders!H:H,"pending_payment")+COUNTIF(SnackOrders!H:H,"payment_verified")'],
    ['G3:H3', 'G4:H5', 'Preparing Orders', '=COUNTIF(SnackOrders!H:H,"preparing")'],
    ['A7:B7', 'A8:B9', 'Ready Orders', '=COUNTIF(SnackOrders!H:H,"ready_for_pickup")'],
    ['C7:D7', 'C8:D9', 'Delivered Orders', '=COUNTIF(SnackOrders!H:H,"delivered")'],
    ['E7:F7', 'E8:F9', 'Average Order Value', '=IFERROR(AVERAGE(FILTER(SnackOrders!G:G,SnackOrders!G:G>0)),0)'],
  ];
  cards.forEach(function (card) {
    const labelRange = sheet.getRange(card[0]);
    const valueRange = sheet.getRange(card[1]);
    labelRange.merge().setValue(card[2]);
    valueRange.merge();
    valueRange.getCell(1, 1).setFormula(card[3]);
    sheet.getRange(labelRange.getRow(), labelRange.getColumn(), 3, 2)
      .setBackground('#ffffff')
      .setBorder(true, true, true, true, false, false, '#e2e8f0', SpreadsheetApp.BorderStyle.SOLID);
    labelRange.setFontFamily('Segoe UI').setFontWeight('bold').setFontSize(9).setFontColor('#64748b').setHorizontalAlignment('center');
    valueRange.setFontFamily('Segoe UI').setFontWeight('bold').setFontSize(18).setFontColor('#0f172a').setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sheet.getRangeList(['C4', 'E8']).setNumberFormat('"Rs." #,##0.00');
  sheet.getRange('A11:H11').merge().setValue('Performance Charts');
  sheet.getRange('A11:H11').setFontFamily('Segoe UI').setFontWeight('bold').setFontSize(12).setFontColor('#0f2a44');
  sheet.setColumnWidths(1, 8, 145);
  sheet.setRowHeights(3, 7, 40);
}

function updateDashboardAndAnalytics_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orders = rowsToObjects_(ss.getSheetByName(CONFIG.ORDERS_SHEET));
  updateAnalytics_(ss.getSheetByName(CONFIG.ANALYTICS_SHEET), orders);
  updateDashboard_(ss.getSheetByName(CONFIG.DASHBOARD_SHEET), orders);
}

function updateDashboard_(sheet, orders) {
  if (!sheet) return;
  sheet.getRange('G7:H9').merge().setValue('Last Refresh\n' + Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm'));
  sheet.getRange('G7:H9')
    .setFontFamily('Segoe UI')
    .setFontWeight('bold')
    .setFontSize(12)
    .setFontColor('#0f2a44')
    .setBackground('#f8fafc')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#e2e8f0', SpreadsheetApp.BorderStyle.SOLID);
  rebuildDashboardCharts_(SpreadsheetApp.getActiveSpreadsheet());
}

function ensureAnalyticsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.ANALYTICS_SHEET);
  sheet.clear();
  sheet.getRange('A1').setValue('Analytics');
  sheet.getRange('A1:H1').setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2937');
}

function updateAnalytics_(sheet, orders) {
  sheet.clear();
  const daily = groupSales_(orders, function (order) { return order.orderDate; });
  const weekly = groupSales_(orders, function (order) { return weekKey_(order.orderDate); });
  const monthly = groupSales_(orders, function (order) { return String(order.orderDate || '').slice(0, 7); });
  const statusDistribution = statusDistribution_(orders);
  const topItems = topSellingItems_(orders);
  const averageOrderValue = orders.length ? sum_(orders.map(function (order) { return order.total; })) / orders.length : 0;

  sheet.setHiddenGridlines(true);
  sheet.getRange('A1').setValue('Daily Sales');
  writeTable_(sheet, 2, 1, ['Date', 'Orders', 'Revenue'], daily);
  sheet.getRange('E1').setValue('Weekly Sales');
  writeTable_(sheet, 2, 5, ['Week', 'Orders', 'Revenue'], weekly);
  sheet.getRange('A20').setValue('Monthly Sales');
  writeTable_(sheet, 21, 1, ['Month', 'Orders', 'Revenue'], monthly);
  sheet.getRange('E20').setValue('Order Status Distribution');
  writeTable_(sheet, 21, 5, ['Status', 'Orders'], statusDistribution);
  sheet.getRange('A38').setValue('Top Selling Items');
  writeTable_(sheet, 39, 1, ['Item', 'Quantity', 'Revenue'], topItems);
  sheet.getRange('E38:F38').setValues([['Average Order Value', averageOrderValue]]);
  sheet.getRangeList(['A1:C1', 'E1:G1', 'A20:C20', 'E20:F20', 'A38:C38'])
    .setFontFamily('Segoe UI')
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#0f2a44');
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 8).setFontFamily('Segoe UI').setFontSize(10);
  sheet.getRangeList(['C:C', 'G:G', 'F:F']).setNumberFormat('"Rs." #,##0.00');
  sheet.autoResizeColumns(1, 8);
}

function writeTable_(sheet, row, col, headers, rows) {
  sheet.getRange(row, col, 1, headers.length)
    .setValues([headers])
    .setFontFamily('Segoe UI')
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#0f2a44')
    .setHorizontalAlignment('center');
  if (rows.length) sheet.getRange(row + 1, col, rows.length, headers.length).setValues(rows);
}

function rebuildDashboardCharts_(ss) {
  const dashboard = ss.getSheetByName(CONFIG.DASHBOARD_SHEET);
  const analytics = ss.getSheetByName(CONFIG.ANALYTICS_SHEET);
  if (!dashboard || !analytics) return;
  dashboard.getCharts().forEach(function (chart) { dashboard.removeChart(chart); });

  addDashboardChart_(dashboard, analytics.getRange('A2:C18'), Charts.ChartType.COLUMN, 'Daily Sales', 13, 1);
  addDashboardChart_(dashboard, analytics.getRange('E2:G18'), Charts.ChartType.LINE, 'Weekly Sales', 13, 5);
  addDashboardChart_(dashboard, analytics.getRange('A21:C36'), Charts.ChartType.COLUMN, 'Monthly Sales', 31, 1);
  addDashboardChart_(dashboard, analytics.getRange('E21:F27'), Charts.ChartType.PIE, 'Order Status Distribution', 31, 5);
  addDashboardChart_(dashboard, analytics.getRange('A39:C49'), Charts.ChartType.BAR, 'Top Selling Items', 49, 1);
}

function addDashboardChart_(dashboard, range, chartType, title, row, col) {
  const builder = dashboard.newChart()
    .setChartType(chartType)
    .addRange(range)
    .setPosition(row, col, 0, 0)
    .setOption('title', title)
    .setOption('fontName', 'Segoe UI')
    .setOption('backgroundColor', '#ffffff')
    .setOption('legend', { position: chartType === Charts.ChartType.PIE ? 'right' : 'bottom' })
    .setOption('height', 280)
    .setOption('width', 560);
  dashboard.insertChart(builder.build());
}

function groupSales_(orders, keyFn) {
  const map = {};
  orders.forEach(function (order) {
    const key = keyFn(order);
    if (!key) return;
    if (!map[key]) map[key] = { count: 0, total: 0 };
    map[key].count += 1;
    map[key].total += Number(order.total || 0);
  });
  return Object.keys(map).sort().reverse().map(function (key) {
    return [key, map[key].count, map[key].total];
  });
}

function statusDistribution_(orders) {
  const counts = {};
  CONFIG.STATUSES.forEach(function (status) { counts[status] = 0; });
  orders.forEach(function (order) {
    const status = normalizeStatus_(order.status);
    if (status) counts[status] = (counts[status] || 0) + 1;
  });
  return CONFIG.STATUSES.map(function (status) { return [status, counts[status] || 0]; });
}

function topSellingItems_(orders) {
  const map = {};
  orders.forEach(function (order) {
    String(order.items || '').split(',').forEach(function (part) {
      const match = part.trim().match(/^(.*?)\s+x\s*(\d+)$/i);
      const name = match ? match[1].trim() : part.trim();
      const qty = match ? Number(match[2]) : 1;
      if (!name) return;
      if (!map[name]) map[name] = { qty: 0, revenue: 0 };
      map[name].qty += qty;
      map[name].revenue += qty ? Number(order.total || 0) / Math.max(totalQuantity_(order.items), 1) * qty : 0;
    });
  });
  return Object.keys(map).sort(function (a, b) { return map[b].qty - map[a].qty; }).map(function (name) {
    return [name, map[name].qty, map[name].revenue];
  });
}

function totalQuantity_(items) {
  return String(items || '').split(',').reduce(function (sum, part) {
    const match = part.trim().match(/\s+x\s*(\d+)$/i);
    return sum + (match ? Number(match[1]) : 1);
  }, 0);
}

function rebuildAdminSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(ss, CONFIG.ADMIN_SHEET);
  const searchOrderId = String(sheet.getRange('B2').getValue() || '').trim().toLowerCase();
  const searchPhone = String(sheet.getRange('C2').getValue() || '').trim().toLowerCase();
  const searchName = String(sheet.getRange('D2').getValue() || '').trim().toLowerCase();
  const orders = rowsToObjects_(ss.getSheetByName(CONFIG.ORDERS_SHEET)).filter(function (order) {
    return (!searchOrderId || String(order.orderId || '').toLowerCase().indexOf(searchOrderId) !== -1) &&
      (!searchPhone || String(order.customerPhone || '').toLowerCase().indexOf(searchPhone) !== -1) &&
      (!searchName || String(order.customerName || '').toLowerCase().indexOf(searchName) !== -1);
  }).sort(function (a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  sheet.clear();
  sheet.setHiddenGridlines(true);
  sheet.getRange('A1').setValue('Search');
  sheet.getRange('B1').setValue('Order ID');
  sheet.getRange('C1').setValue('Phone');
  sheet.getRange('D1').setValue('Customer Name');
  sheet.getRange('B2').setValue(searchOrderId);
  sheet.getRange('C2').setValue(searchPhone);
  sheet.getRange('D2').setValue(searchName);
  sheet.getRange('A3:I3').setValues([CONFIG.HEADERS]);
  if (orders.length) {
    sheet.getRange(4, 1, orders.length, CONFIG.HEADERS.length).setValues(
      orders.map(function (order) {
        return CONFIG.HEADERS.map(function (key) { return order[key]; });
      })
    );
  }
  sheet.setFrozenRows(3);
  sheet.getRange('A1:I3')
    .setFontFamily('Segoe UI')
    .setFontWeight('bold')
    .setBackground('#0f2a44')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.getRange('B2:D2').setBackground('#ffffff').setFontColor('#111827').setFontWeight('normal').setHorizontalAlignment('left');
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), CONFIG.HEADERS.length).setFontFamily('Segoe UI').setFontSize(10).setWrap(true).setVerticalAlignment('middle');
  if (orders.length) sheet.setRowHeights(4, orders.length, 36);
  applyStatusValidation_(sheet, 4, Math.max(orders.length, 1));
  applyStatusColors_(sheet, 4);
  applyAlternatingColors_(sheet, Math.max(sheet.getLastRow(), 3), CONFIG.HEADERS.length);
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(3, 1, Math.max(orders.length + 1, 1), CONFIG.HEADERS.length).createFilter();
  applyOrderColumnWidths_(sheet);
}

function formatMenuSheet_(ss) {
  const sheet = ss.getSheetByName(CONFIG.MENU_SHEET);
  if (!sheet) return;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, lastCol)
    .setFontFamily('Segoe UI')
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#0f2a44')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 34);
  if (lastRow > 1) sheet.setRowHeights(2, lastRow - 1, 34);
  sheet.getRange(1, 1, lastRow, lastCol)
    .setFontFamily('Segoe UI')
    .setFontSize(10)
    .setWrap(true)
    .setVerticalAlignment('middle')
    .setBorder(false, false, false, false, false, false);
  sheet.getBandings().forEach(function (banding) { banding.remove(); });
  if (lastRow > 1) {
    const banding = sheet.getRange(1, 1, lastRow, lastCol).applyRowBanding();
    banding.setHeaderRowColor('#0f2a44').setFirstRowColor('#ffffff').setSecondRowColor('#f8fafc');
  }
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (header) {
    return String(header || '').trim().toLowerCase();
  });
  headers.forEach(function (header, index) {
    if (header === 'price') sheet.getRange(1, index + 1, lastRow, 1).setNumberFormat('"Rs." #,##0.00');
    if (header === 'name') sheet.setColumnWidth(index + 1, 220);
    if (header === 'image' || header === 'imageurl') sheet.setColumnWidth(index + 1, 260);
    if (header === 'active') sheet.getRange(2, index + 1, Math.max(lastRow - 1, 1), 1).setHorizontalAlignment('center');
  });
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(1, 1, lastRow, lastCol).createFilter();
  sheet.autoResizeColumns(1, lastCol);
}

function getMenuItems_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.MENU_SHEET);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (header) { return String(header || '').trim(); });
  return values.slice(1).map(function (row, rowIndex) {
    const item = {};
    headers.forEach(function (header, index) { item[header] = row[index]; });
    item.id = String(item.id || item.ID || rowIndex + 1);
    item.name = String(item.name || item.Name || '').trim();
    item.price = Number(item.price || item.Price || 0);
    item.category = String(item.category || item.Category || '').trim();
    item.image = String(item.image || item.Image || item.imageUrl || '').trim();
    item.active = item.active === undefined || item.active === '' ? true : String(item.active).toLowerCase() !== 'false';
    return item;
  }).filter(function (item) { return item.name && item.price && item.active; });
}

function normalizeStatus_(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const map = {
    pending: 'pending_payment',
    awaiting_payment: 'pending_payment',
    pending_payment: 'pending_payment',
    paid: 'payment_verified',
    payment_verified: 'payment_verified',
    cooking: 'preparing',
    preparing: 'preparing',
    ready: 'ready_for_pickup',
    ready_for_pickup: 'ready_for_pickup',
    completed: 'delivered',
    delivered: 'delivered',
    canceled: 'cancelled',
    cancelled: 'cancelled',
  };
  return map[normalized] || '';
}

function normalizeDate_(value) {
  if (!value) return '';
  if (value instanceof Date) return Utilities.formatDate(value, CONFIG.TIME_ZONE, CONFIG.DATE_FORMAT);
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slash) return slash[3] + '-' + slash[2].padStart(2, '0') + '-' + slash[1].padStart(2, '0');
  const date = new Date(raw);
  return isNaN(date.getTime()) ? '' : Utilities.formatDate(date, CONFIG.TIME_ZONE, CONFIG.DATE_FORMAT);
}

function normalizeTimestamp_(value) {
  const date = value ? new Date(value) : new Date();
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function todayKey_() {
  return Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, CONFIG.DATE_FORMAT);
}

function weekKey_(dateKey) {
  const date = new Date(dateKey + 'T00:00:00');
  if (isNaN(date.getTime())) return '';
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
  return date.getFullYear() + '-W' + String(week).padStart(2, '0');
}

function clean_(value) {
  return String(value || '').trim();
}

function sum_(values) {
  return values.reduce(function (total, value) { return total + Number(value || 0); }, 0);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
