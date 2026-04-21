# API Integration Fixes - Debugging Guide

## 🔧 Issues Fixed

### 1. **No Request Timeout**
   - **Problem**: API requests could hang indefinitely
   - **Fix**: Added 8-second timeout for all requests
   - **Location**: `src/services/sheetsService.js` → `fetchWithTimeout()`

### 2. **No Retry Logic**
   - **Problem**: Failed on first attempt, no recovery
   - **Fix**: Added exponential backoff retry (2 attempts total)
   - **Location**: `src/services/sheetsService.js` → `retryWithBackoff()`

### 3. **No Fallback Menu**
   - **Problem**: Blank screen when API fails
   - **Fix**: Added 8-item fallback menu with real menu data
   - **Location**: `src/services/sheetsService.js` → `FALLBACK_MENU_DATA`

### 4. **Poor Error Messages**
   - **Problem**: Technical errors shown to users
   - **Fix**: User-friendly error UI with retry button
   - **Location**: `src/components/Menu.js` → Error container

### 5. **API Proxy Timeout (502 Error)**
   - **Problem**: Backend proxy had no timeout/retry logic
   - **Fix**: Added 8-second timeout + 2 retries in `api/menu.js`
   - **Location**: `api/menu.js`

### 6. **Poor Debugging**
   - **Problem**: Difficult to diagnose production issues
   - **Fix**: Added console logging at each step
   - **Location**: `src/services/sheetsService.js`, `api/menu.js`, `api/health.js`

---

## 📋 Deployment Checklist

### Step 1: Verify Environment Variables on Vercel

Go to: **Vercel Dashboard → Settings → Environment Variables**

Ensure these are set:
```
ORDERS_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
REACT_APP_ORDERS_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
REACT_APP_MENU_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

⚠️ **Important**: Both `ORDERS_API_URL` and `REACT_APP_ORDERS_API_URL` must be set.
- `ORDERS_API_URL`: Used by backend (Node.js)
- `REACT_APP_ORDERS_API_URL`: Used by frontend (React)

### Step 2: Deploy to Vercel

```bash
git add .
git commit -m "feat: Add API timeout, retry logic, and fallback menu"
git push
```

Vercel will auto-deploy. Check:
- **Build Status**: Should show "✓ Ready"
- **Environment**: Variables should be loaded

### Step 3: Test Health Check

After deployment, test the health endpoint:

```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "deployment": { "platform": "Vercel" },
  "config": {
    "ordersApiConfigured": true,
    "webhookSecretConfigured": true
  },
  "upstream": {
    "reachable": true,
    "responseTime": 234
  }
}
```

---

## 🐛 Debugging Steps

### Check 1: Frontend Console Logs

Open browser DevTools (F12) → Console tab

Look for logs starting with `[Menu Fetch]`:
```
[Menu Fetch] Starting menu fetch from base origin: https://anupama-canteen.vercel.app
[Menu Fetch] Attempting to fetch from: /api/menu
[Menu Fetch] HTTP 502 from https://...
[Menu Fetch] Attempt 1/2 failed: HTTP 502
[Menu Fetch] Using cached menu with 15 items
```

**Scenarios:**
- ✅ "Successfully loaded items" → API is working
- ⚠️ "Using cached menu" → API failed, but cache saved the day
- ❌ "Using fallback menu data" → Both API and cache failed

### Check 2: Verify Backend API

Test if Google Apps Script is accessible:

```bash
curl "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=menu"
```

Expected: JSON array of menu items

If you get:
- `404 Not Found` → Wrong script ID
- `401 Unauthorized` → Script not deployed publicly
- `503 Service Unavailable` → Google Apps Script quota exceeded

### Check 3: Check Vercel Function Logs

1. Go to **Vercel Dashboard → Deployments → Your Deployment**
2. Click **Logs** tab
3. Look for `/api/menu` requests
4. Check for timeout/retry logs

Expected logs:
```
[API/Menu] Fetching from: https://script.google.com/...
[API/Menu] Attempt 1/2 to fetch menu
[API/Menu] Successfully fetched menu from upstream
```

### Check 4: Test with Different Network Conditions

Simulate slow network (Chrome DevTools):
1. **F12 → Network tab**
2. **Throttling dropdown → Slow 3G**
3. Refresh page
4. Should see retries working

---

## 🚀 Performance Improvements

### Request Timeout: 8 seconds
- Per request: 8000ms timeout
- Retries: 2 attempts
- Max total time: ~16 seconds (with exponential backoff)

### Exponential Backoff
```
Attempt 1: Immediate
Attempt 2: Wait 500ms, then retry
Attempt 3: Wait 1000ms, then retry
```

### Cache Strategy
1. **Try API** → Use fresh data
2. **API fails** → Use localStorage cache (up to 30 days old)
3. **No cache** → Use fallback menu

---

## ⚡ Network Issues - Solutions

### Problem: "Request Timeout"

**Cause**: Google Apps Script is slow or down

**Solution**:
```javascript
// Already handled in sheetsService.js:
- Retry with exponential backoff
- Falls back to cache
- Falls back to hardcoded menu
```

### Problem: "HTTP 502 Bad Gateway"

**Cause**: Vercel proxy can't reach Google Apps Script

**Solution**:
```javascript
// Fixed in api/menu.js:
- Added 8-second timeout
- Added retry logic (2 attempts)
- Added detailed error logging
```

### Problem: "CORS Error"

**Cause**: Browser blocks cross-origin requests (shouldn't happen with `/api/menu` proxy)

**Solution**:
- Use `/api/menu` endpoint (already configured)
- Set proper headers (already done)
- Don't call Google Apps Script directly from browser

### Problem: "Failed to Fetch"

**Cause**: Network disconnected or DNS lookup failed

**Solution**:
```javascript
// Already handled:
- Retry logic will attempt again
- Cache provides fallback
- Fallback menu is last resort
```

---

## 📊 Monitoring & Analytics

### Logging Points

The app now logs at these key points:

1. **Menu Fetch Start**
   ```
   [Menu Fetch] Starting menu fetch from base origin: ...
   ```

2. **Each Attempt**
   ```
   [Menu Fetch] Attempting to fetch from: /api/menu
   ```

3. **Success**
   ```
   [Menu Fetch] Successfully loaded 15 items from menu_proxy
   ```

4. **Retry**
   ```
   [Menu Fetch] Attempt 1/3 failed: HTTP 502
   [Menu Fetch] Using cached menu
   ```

5. **Fallback**
   ```
   [Menu Fetch] All API endpoints failed. Using fallback menu data.
   ```

### Recommended: Add Sentry for Production

Add error tracking to catch issues early:

```javascript
// In App.js
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: "production"
});
```

---

## 🔐 Security Notes

### API Configuration

**Frontend (.env)**:
- `REACT_APP_ORDERS_API_URL` → Public URL
- `REACT_APP_MENU_API_URL` → Public URL
- These are safe to commit (no secrets)

**Backend (Vercel Secrets)**:
- `ORDERS_API_URL` → Server-side only
- `WEBHOOK_SECRET` → Protect webhook validation
- `WHATSAPP_API_TOKEN` → Never in frontend

### Webhook Secret

Current default: "change-me" ⚠️ **INSECURE**

To fix:
1. In Vercel Dashboard → Settings → Environment Variables
2. Set `WEBHOOK_SECRET` to a secure random string
3. Update webhook validation in `api/payment-confirmed.js`

---

## 🆘 Common Issues

### Issue: Menu loads but with only 8 items

**Diagnosis**: Fallback menu is being used

**Solution**:
1. Check `/api/health` endpoint
2. Verify Google Apps Script is deployed publicly
3. Check Vercel logs for `api/menu` errors
4. Verify `ORDERS_API_URL` environment variable

### Issue: Menu loads slowly (>5 seconds)

**Diagnosis**: API is slow or network is slow

**Optimization**:
1. Test directly: `curl https://script.google.com/...`
2. Optimize Google Apps Script (reduce data processing)
3. Consider caching strategy: 30-minute cache instead of 30 seconds

### Issue: Menu never loads, only shows fallback

**Diagnosis**: Both API and cache failed

**Solution**:
1. Clear localStorage: `localStorage.clear()` in DevTools
2. Check network tab for 502/503 errors
3. Verify environment variables on Vercel
4. Check if Google Apps Script quota exceeded

---

## 📞 Getting Help

### Debugging URLs

**Health Check**: `https://your-app.vercel.app/api/health`

**Direct API Call**: `https://your-app.vercel.app/api/menu`

**Vercel Logs**: https://vercel.com/dashboard

### Logs to Check

1. **Browser Console** (F12 → Console)
   - `[Menu Fetch]` logs
   - CORS errors
   - Network errors

2. **Vercel Function Logs**
   - Go to Deployment → Logs tab
   - Filter for `/api/menu`

3. **Network Tab** (F12 → Network)
   - See actual HTTP requests
   - Check response status and time
   - Look for failed/retried requests

---

## ✅ Verification Checklist

After deploying, verify:

- [ ] Home page loads without errors
- [ ] Menu displays 15+ items (not fallback)
- [ ] `/api/health` returns `"status": "ok"`
- [ ] Retry button appears on error
- [ ] Menu updates every 30 seconds (check cache update time)
- [ ] Search/filter works on menu items
- [ ] Add to cart works
- [ ] Console shows `[Menu Fetch] Successfully loaded` logs
- [ ] No 502 errors in Vercel logs

---

Last Updated: April 21, 2026
