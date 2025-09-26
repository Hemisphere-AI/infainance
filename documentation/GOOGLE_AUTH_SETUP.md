# Google Authentication Setup Guide

This guide will help you set up Google authentication for your Excel Preview App.

## 🔧 **Step 1: Create Google OAuth 2.0 Credentials**

### **1.1 Create a Google Cloud Project**

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown and select "New Project"
3. Enter a project name (e.g., "Excel Preview App")
4. Click "Create"

### **1.2 Enable Google Identity API**

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Identity" or "Google+ API"
3. Click "Google Identity" and then "Enable"

### **1.3 Configure OAuth Consent Screen**

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type and click "Create"
3. Fill in the required information:
   - **App name:** Excel Preview App (or your preferred name)
   - **User support email:** Your email address
   - **Developer contact information:** Your email address
4. **Authorized domains:** Add your Netlify domain (e.g., `your-app.netlify.app`)
5. Click "Save and Continue" through all steps

### **1.4 Create OAuth 2.0 Credentials**

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application" as the application type
4. **Name:** Excel Preview App Auth
5. **Authorized JavaScript origins:**
   - `https://your-app.netlify.app` (your actual Netlify URL)
   - `http://localhost:5173` (for local development)
   - `http://localhost:4173` (for local preview)
6. **Authorized redirect URIs:**
   - `https://your-app.netlify.app` (your actual Netlify URL)
   - `http://localhost:5173` (for local development)
7. Click "Create"
8. **Copy your Client ID** - you'll need this for the environment variables

## 🔧 **Step 2: Update Environment Variables**

### **2.1 Local Development**

Create or update your `.env` file in the project root:

```env
# OpenAI API Key (you already have this)
VITE_OPENAI_KEY=your_openai_api_key_here

# Google OAuth Client ID (new)
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
```

### **2.2 Netlify Deployment**

1. Go to your Netlify dashboard
2. Select your site
3. Go to Site Settings → Environment Variables
4. Add the following variables:
   - **Name:** `VITE_OPENAI_KEY` **Value:** Your OpenAI API key
   - **Name:** `VITE_GOOGLE_CLIENT_ID` **Value:** Your Google Client ID

### **2.3 Update Authorized Origins (Important!)**

After your site is deployed to Netlify:

1. Go back to Google Cloud Console → APIs & Services → Credentials
2. Click on your OAuth client ID
3. Update "Authorized JavaScript origins" and "Authorized redirect URIs" with your actual Netlify URL
4. Save the changes

## 🚀 **Step 3: Deploy and Test**

### **3.1 Build and Deploy**

```bash
# Build the project
npm run build

# Deploy to Netlify (drag & drop the dist folder)
# Or push to GitHub if you have auto-deploy set up
```

### **3.2 Test Authentication**

1. Visit your deployed app
2. You should see a login screen
3. Click "Sign in with Google"
4. Complete the Google OAuth flow
5. You should be redirected back to your app and logged in

## 🔍 **Troubleshooting**

### **Common Issues:**

1. **"Error 400: redirect_uri_mismatch"**
   - Check that your Netlify URL is added to "Authorized redirect URIs" in Google Console
   - Make sure the URL matches exactly (https vs http, trailing slash, etc.)

2. **"Error 400: invalid_request"**
   - Verify your `VITE_GOOGLE_CLIENT_ID` environment variable is set correctly
   - Check that the Client ID is the correct format (ends with `.apps.googleusercontent.com`)

3. **Google Sign-In button not appearing****
   - Check browser console for errors
   - Verify the Google Identity Services script is loading (`https://accounts.google.com/gsi/client`)
   - Make sure your domain is in the authorized domains list

4. **Authentication working locally but not on Netlify**
   - Verify environment variables are set in Netlify dashboard
   - Check that your Netlify URL is in the authorized origins
   - Redeploy your site after adding environment variables

### **Testing Checklist:**

- [ ] Google Client ID is created and copied
- [ ] Environment variables are set (both locally and on Netlify)
- [ ] Authorized origins include your Netlify URL
- [ ] OAuth consent screen is configured
- [ ] App is rebuilt and redeployed after adding environment variables

## 📋 **Environment Variables Summary**

You need these two environment variables:

1. **`VITE_OPENAI_KEY`** - Your OpenAI API key (already exists)
2. **`VITE_GOOGLE_CLIENT_ID`** - Your Google OAuth Client ID (new)

## 🎯 **What Happens After Setup**

Once everything is configured:

1. **Unauthenticated users** see a beautiful login screen
2. **After Google sign-in** users access your Excel Preview App
3. **User profile** appears in the top-right corner with logout option
4. **Session persists** across browser refreshes
5. **Sign-out** returns users to the login screen

## 🔒 **Security Notes**

- The Google Client ID is safe to expose in client-side code
- User authentication is handled by Google's secure OAuth flow
- No sensitive user data is stored in your application
- Sessions are managed client-side with secure tokens

Your app is now protected with Google authentication! 🎉
