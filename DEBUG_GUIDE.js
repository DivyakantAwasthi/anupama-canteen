/**
 * Browser DevTools Debugging Guide
 * 
 * Open browser DevTools: F12 (Windows) or Cmd+Option+I (Mac)
 * 
 * QUICK DEBUGGING COMMANDS
 */

// ========== DEBUGGING COMMANDS ==========

// 1. See all console logs related to menu fetching
// (Open DevTools Console and look for logs starting with [Menu Fetch])

// 2. Check cached menu
localStorage.getItem('anupama:menu:cache:v1') 
// Returns: JSON array of cached menu items or null

// 3. Clear cache (to force fresh API fetch)
localStorage.removeItem('anupama:menu:cache:v1')

// 4. Check all stored data
localStorage
// Shows all keys and values

// 5. Force menu refresh
// Run this in Console:
document.querySelector('button:contains("Retry")').click()
// Or go to app and click the Retry button

// ========== EXPECTED LOG MESSAGES ==========

/*
✅ HEALTHY SCENARIO (API working):

[Menu Fetch] Starting menu fetch from base origin: https://anupama-canteen.vercel.app
[Menu Fetch] Attempting to fetch from: /api/menu
[Menu Fetch] Successfully fetched from https://anupama-canteen.vercel.app/api/menu
[Menu Fetch] Successfully loaded 15 items from menu_proxy

*/

/*
⚠️ RECOVERY SCENARIO (API slow, retry works):

[Menu Fetch] Starting menu fetch from base origin: https://anupama-canteen.vercel.app
[Menu Fetch] Attempting to fetch from: /api/menu
[Menu Fetch] Attempt 1/2 failed: request_timeout
[Menu Fetch] Attempting to fetch from: /menu_api_url
[Menu Fetch] Successfully loaded 15 items from menu_api_url

*/

/*
📍 FALLBACK SCENARIO (API down, cache empty):

[Menu Fetch] Starting menu fetch from base origin: https://anupama-canteen.vercel.app
[Menu Fetch] Attempting to fetch from: /api/menu
[Menu Fetch] Attempt 1/2 failed: HTTP 502
[Menu Fetch] Using cached menu with 15 items (API unavailable)

*/

/*
🚨 FALLBACK MENU SCENARIO (everything failed):

[Menu Fetch] Starting menu fetch from base origin: https://anupama-canteen.vercel.app
[Menu Fetch] Attempting to fetch from: /api/menu
[Menu Fetch] Attempt 1/2 failed: HTTP 502
[Menu Fetch] Attempting to fetch from: /menu_api_url
[Menu Fetch] Attempt 1/2 failed: Failed to fetch
[Menu Fetch] All API endpoints failed and no cache available. Using fallback menu data.

*/

// ========== NETWORK TAB DEBUGGING ==========

/*
To debug API calls:

1. Open DevTools (F12)
2. Go to Network tab
3. Refresh page (Ctrl+R)
4. Look for these requests:
   - /api/menu
   - /api/health (optional)

5. Click on each request to see:
   - Status: 200 (success), 502 (bad gateway), 404 (not found)
   - Time: How long it took
   - Response: The data returned

EXPECTED:
- /api/menu → Status 200 → Response: Array of menu items
- /api/health → Status 200 → Response: { "status": "ok", ... }

ISSUES:
- /api/menu → Status 502 → Backend timeout
- /api/menu → Status 404 → Wrong endpoint
- /api/menu → Status 403 → CORS issue
- No response → Network timeout

*/

// ========== MANUAL API TESTING ==========

/*
Test API from Console:

// Test menu endpoint
fetch('/api/menu')
  .then(r => r.json())
  .then(data => console.log('Menu:', data))
  .catch(e => console.error('Error:', e))

// Test health endpoint
fetch('/api/health')
  .then(r => r.json())
  .then(data => console.log('Health:', data))
  .catch(e => console.error('Error:', e))

// Test with headers
fetch('/api/menu', {
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
})
  .then(r => r.json())
  .then(data => console.log('Menu with headers:', data))
  .catch(e => console.error('Error:', e))

*/

// ========== COMMON ERRORS & SOLUTIONS ==========

/*

ERROR: "Failed to fetch"
- Cause: Network error or CORS issue
- Solution: Check network tab for actual error
- Expected: Should auto-retry after 500ms

ERROR: "HTTP 502"
- Cause: Backend timeout or bad gateway
- Solution: Expected in api/menu.js, should retry
- Expected: Should retry after 500ms

ERROR: "request_timeout"
- Cause: Request took >8 seconds
- Solution: API is slow, should fallback
- Expected: Should try other endpoints

ERROR: "SyntaxError: Unexpected token < in JSON"
- Cause: Response is HTML (error page) not JSON
- Solution: Check if Google Apps Script is deployed

ERROR: "CORS error" (in Console)
- Cause: Cross-origin request blocked
- Solution: Should not happen with /api/menu proxy
- Action: Use /api/menu instead of direct script URL

*/

// ========== PERFORMANCE MONITORING ==========

/*
Check page load performance:

// Total load time
performance.timing.loadEventEnd - performance.timing.navigationStart

// API fetch time
// Look in Network tab, check the Time column for /api/menu

// Expected times:
// - First load: 2-4 seconds total
// - Menu fetch: 0.5-3 seconds
// - Cached: <100ms

*/

// ========== LOCAL STORAGE INSPECTION ==========

/*
View all stored data:

console.table(Object.entries(localStorage).map(([k, v]) => ({
  key: k,
  size: v.length + ' bytes',
  preview: v.substring(0, 50) + '...'
})))

View menu cache:
const cached = JSON.parse(localStorage.getItem('anupama:menu:cache:v1'))
console.table(cached)

View orders:
Object.entries(localStorage)
  .filter(([k]) => k.startsWith('anupama:orders:'))
  .map(([k, v]) => ({key: k, orders: JSON.parse(v).length}))

*/

// ========== SIMULATE ERRORS (Testing) ==========

/*
If you want to test error handling:

// Simulate slow network in DevTools:
1. Go to Network tab
2. Click Throttling dropdown (usually "No throttling")
3. Select "Slow 3G"
4. Refresh page
5. Should see retries happening

// Simulate API failure:
1. In app.js loadMenu function, add test code
2. Or manually set API URL to invalid value:
   localStorage.setItem('test-api-fail', 'true')
   Then reload page

// Simulate cache miss:
1. Clear cache: localStorage.clear()
2. Reload page
3. Should show fallback menu if API fails

*/

// ========== LOGS TO SHARE WITH DEVELOPER ==========

/*
If having issues, collect and share:

1. Screenshot of Console (F12 → Console)
   - Copy all [Menu Fetch] logs

2. Screenshot of Network tab (F12 → Network)
   - Filter for /api/menu and /api/health
   - Show Status, Time, Response size

3. Output of this command in Console:
   {
     userAgent: navigator.userAgent,
     url: window.location.href,
     cacheSize: localStorage.getItem('anupama:menu:cache:v1')?.length || 0,
     isOnline: navigator.onLine
   }

4. Vercel Logs:
   - Go to https://vercel.com/dashboard
   - Select deployment
   - Click Logs tab
   - Copy relevant errors

*/

// ========== QUICK TEST CHECKLIST ==========

/*
Run this in Console to get a health report:

async function healthCheck() {
  console.log('=== ANUPAMA CANTEEN HEALTH CHECK ===')
  
  // 1. Check cache
  const cache = localStorage.getItem('anupama:menu:cache:v1')
  console.log('Cache:', cache ? `${JSON.parse(cache).length} items` : 'Empty')
  
  // 2. Check API health
  try {
    const health = await fetch('/api/health').then(r => r.json())
    console.log('API Health:', health.status)
    console.log('  - Orders API:', health.config.ordersApiConfigured ? '✓' : '✗')
    console.log('  - Upstream:', health.upstream.reachable ? '✓' : '✗')
  } catch (e) {
    console.error('Health check failed:', e.message)
  }
  
  // 3. Check menu endpoint
  try {
    const menu = await fetch('/api/menu').then(r => r.json())
    console.log('Menu API:', Array.isArray(menu) ? `✓ ${menu.length} items` : '✗ Invalid response')
  } catch (e) {
    console.error('Menu API failed:', e.message)
  }
  
  console.log('=== END HEALTH CHECK ===')
}

healthCheck()

*/

console.log(
  '%c🍛 Anupama Canteen Debug Guide Loaded',
  'color: #dc2626; font-size: 16px; font-weight: bold'
);
console.log(
  '%cOpen this file for debugging commands and common issues',
  'color: #666'
);
