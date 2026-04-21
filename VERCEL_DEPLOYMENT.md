# Vercel Deployment Guide - API Integration Fixes

## 🎯 Quick Start

This guide helps you deploy the fixed API integration to Vercel.

---

## 📋 Pre-Deployment Checklist

### 1. Get Your Google Apps Script URL

You need the public URL of your Google Apps Script web app.

**Format**: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`

If you don't have this:
- Ask your backend developer or
- Check your existing environment variables in `.env`

### 2. Verify Your Script is Published

In Google Apps Script editor:
1. Click **Deploy** → **New deployment**
2. Type: Choose **Web app**
3. Execute as: Your email
4. Who has access: **Anyone**
5. Click **Deploy**
6. Copy the deployment URL

---

## 🚀 Deployment Steps

### Step 1: Push Code to GitHub

```bash
cd /path/to/anupama-canteen
git add .
git commit -m "feat: Add API timeout, retry logic, and fallback menu"
git push origin main
```

### Step 2: Set Environment Variables on Vercel

**Option A: Via Vercel CLI (Recommended)**

```bash
npm install -g vercel

vercel env add ORDERS_API_URL
# Paste your Google Apps Script URL when prompted
# Example: https://script.google.com/macros/s/AKfycbz.../exec

vercel env add REACT_APP_ORDERS_API_URL
# Paste same URL

vercel env add REACT_APP_MENU_API_URL
# Paste same URL
```

**Option B: Via Vercel Dashboard**

1. Go to: https://vercel.com/dashboard
2. Select your project: `anupama-canteen`
3. Click **Settings** → **Environment Variables**
4. Add these variables (paste the same Google Apps Script URL):
   - `ORDERS_API_URL`
   - `REACT_APP_ORDERS_API_URL`
   - `REACT_APP_MENU_API_URL`

5. In the "Environments" dropdown, select:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

### Step 3: Deploy

**Option A: Automatic (Recommended)**

```bash
git push origin main
```

Vercel will auto-deploy when you push to GitHub.

**Option B: Manual**

```bash
vercel --prod
```

### Step 4: Wait for Deployment

Check the deployment status:

```bash
vercel logs
```

Expected output:
```
✓ Deployment ready
✓ Frontend built successfully
✓ API functions compiled
```

---

## ✅ Verification After Deployment

### 1. Test Health Endpoint

```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "config": {
    "ordersApiConfigured": true
  },
  "upstream": {
    "reachable": true,
    "responseTime": 234
  }
}
```

### 2. Test Menu API

```bash
curl https://your-app.vercel.app/api/menu
```

Expected: JSON array with menu items

### 3. Open Website in Browser

1. Go to: https://anupama-canteen.vercel.app/
2. Open DevTools (F12) → Console tab
3. Look for logs: `[Menu Fetch] Successfully loaded`
4. Menu should display 15+ items
5. Try search functionality

### 4. Check Vercel Logs

```bash
vercel logs --prod
```

Look for:
- ✅ `[API/Menu] Successfully fetched menu`
- ✅ No 502 errors

---

## 🐛 Troubleshooting

### Issue: Menu still shows error after deployment

**Step 1: Check Vercel Logs**
```bash
vercel logs --prod --follow
```

**Step 2: Verify Environment Variables**
```bash
vercel env list
```

Ensure you see:
```
ORDERS_API_URL ✓
REACT_APP_ORDERS_API_URL ✓
REACT_APP_MENU_API_URL ✓
```

**Step 3: Redeploy if Variables Changed**
```bash
git commit --allow-empty -m "redeploy"
git push
```

### Issue: Health check returns "degraded"

This means the Google Apps Script is not reachable.

**Check 1: Is the Script URL Correct?**
```bash
vercel env list
# Copy the ORDERS_API_URL value and test it:
curl "YOUR_ORDERS_API_URL?action=menu"
```

**Check 2: Is the Script Published?**
- Go to Google Apps Script editor
- Click Deploy → Manage deployments
- Verify "Who has access" is set to "Anyone"

**Check 3: Is the Script Responding?**
- Test directly in browser:
  - `https://script.google.com/macros/s/YOUR_ID/exec?action=menu`
- You should see JSON array or error message

### Issue: Getting "CORS error" in Console

**This should NOT happen** with the `/api/menu` proxy, but if it does:

Check that you're calling `/api/menu` (not the Google Apps Script directly):

```javascript
// ✅ Correct - Uses Vercel proxy
fetch('/api/menu')

// ❌ Wrong - Calls Google Apps Script directly
fetch('https://script.google.com/macros/s/.../exec')
```

The fix is already in place, so verify you're using the proxy endpoint.

### Issue: Homepage works but menu API returns 502

**Cause**: Google Apps Script timeout (>30 seconds)

**Solution**:
1. Check Google Apps Script performance
2. Reduce data processing time
3. Add database indexing if using Google Sheets

---

## 📊 Monitoring Deployment

### View Real-Time Logs

```bash
vercel logs --follow
```

### Monitor for Errors

Add monitoring to catch issues:

1. **Vercel Analytics** (Built-in)
   - Go to Project → Analytics
   - View response times and errors

2. **External Monitoring** (Recommended)
   - Sign up for Sentry: https://sentry.io
   - Add to your app for error tracking

---

## 🔄 Rollback If Needed

If something goes wrong:

```bash
vercel rollback
```

This reverts to the previous working deployment.

---

## 💡 Performance Optimization

### After Successful Deployment

**Measure baseline performance**:
```bash
curl -w "@format.txt" https://your-app.vercel.app/api/menu
```

**Optimize if needed**:
1. Reduce menu refresh interval (currently 30 seconds)
2. Implement Redis caching (advanced)
3. Optimize Google Apps Script queries

---

## 📞 Still Having Issues?

### Debug Checklist

1. ✅ GitHub pushed successfully
2. ✅ Environment variables set on Vercel
3. ✅ Google Apps Script is public
4. ✅ `/api/health` returns `"status": "ok"`
5. ✅ Vercel logs show no 502 errors
6. ✅ Menu items display in browser (or fallback)

### Get Logs for Support

Run this and save output:

```bash
vercel logs --prod > deployment_logs.txt
```

Then:
1. Check browser console (F12) and save screenshot
2. Share both files with your developer

---

## 🎉 You're Done!

Your Anupama Canteen website is now deployed with:
- ✅ API timeout handling
- ✅ Retry logic with exponential backoff
- ✅ Fallback menu system
- ✅ User-friendly error messages
- ✅ Comprehensive logging for debugging

**Test it here**: https://anupama-canteen.vercel.app/

---

**Last Updated**: April 21, 2026  
**Deployment Target**: Vercel  
**Status**: Production Ready
