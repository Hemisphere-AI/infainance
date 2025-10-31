# OAuth Redirect URL Fix

## 🔍 Problem
After Google OAuth login, users are redirected to production (`getzenith.ai`) instead of staying in their current environment:
- **Local development**: `localhost:5174/login` → should redirect to `localhost:5174/app`
- **Production**: `getzenith.ai/login` → should redirect to `getzenith.ai/app`

## 🔧 Root Cause
The Supabase project configuration has incorrect redirect URLs configured.

## ✅ Solution

### 1. Update Supabase Dashboard
You need to update the redirect URLs in your Supabase project dashboard:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Go to Authentication → URL Configuration**
4. **Update the following settings**:

#### Site URL
```
https://getzenith.ai
```

#### Redirect URLs
Add all these URLs (one per line):
```
https://getzenith.ai/app
http://localhost:5174/app
http://127.0.0.1:5174/app
https://127.0.0.1:5174/app
```

### 2. Update Google OAuth Configuration
In your Google Cloud Console:

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select your project**
3. **Go to APIs & Services → Credentials**
4. **Edit your OAuth 2.0 Client ID**
5. **Update Authorized redirect URIs**:

Add these URIs:
```
https://your-project-id.supabase.co/auth/v1/callback
```

**Note**: Replace `your-project-id` with your actual Supabase project ID.

### 3. Local Configuration Updated
✅ **Already fixed**: Updated `supabase/config.toml` with correct redirect URLs.

## 🧪 Testing

### Test Local Development
1. Start your local dev server: `npm run dev`
2. Go to `http://localhost:5174/login`
3. Click "Sign in with Google"
4. After OAuth, you should be redirected to `http://localhost:5174/app`

### Test Production
1. Go to `https://getzenith.ai/login`
2. Click "Sign in with Google"
3. After OAuth, you should be redirected to `https://getzenith.ai/app`

## 🔍 How It Works

The OAuth flow uses `window.location.origin` to determine the current environment:

```javascript
// In SupabaseAuthContext.jsx
redirectTo: `${window.location.origin}/app`
```

- **Local**: `window.location.origin` = `http://localhost:5174`
- **Production**: `window.location.origin` = `https://getzenith.ai`

The Supabase configuration must allow these redirect URLs for the OAuth flow to work correctly.

## ⚠️ Important Notes

1. **Supabase Dashboard**: The redirect URLs in the dashboard override the local config file
2. **Google OAuth**: Must have the Supabase callback URL configured
3. **HTTPS Required**: Production URLs must use HTTPS
4. **Exact Match**: URLs must match exactly (including protocol and port)

## 🚨 If Still Not Working

If the redirect still doesn't work after updating the dashboard:

1. **Check Supabase logs** in the dashboard for OAuth errors
2. **Verify Google OAuth** has the correct callback URL
3. **Clear browser cache** and try again
4. **Check browser console** for any JavaScript errors

## 📝 Files Changed

- ✅ `supabase/config.toml` - Updated redirect URLs
- ✅ `src/contexts/SupabaseAuthContext.jsx` - Already uses `window.location.origin`
- ✅ `src/services/googleOAuthService.js` - Already uses `window.location.origin`
