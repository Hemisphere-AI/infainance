# Deployment Guide

This guide covers the best and easiest ways to deploy your Excel Preview App.

## 🚀 **Recommended: Vercel (Easiest & Best)**

### Why Vercel?
- ✅ **Zero configuration** - Just connect your GitHub repo
- ✅ **Automatic builds** from your `dist/` folder
- ✅ **Free tier** with generous limits
- ✅ **Global CDN** for fast loading
- ✅ **Custom domains** available
- ✅ **Environment variables** for your OpenAI API key

### Steps to Deploy on Vercel:

1. **Prepare your repository:**
   ```bash
   # Make sure your code is committed and pushed to GitHub
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign up with GitHub
   - Click "New Project" and select your `infainance` repository
   - Vercel will auto-detect it's a Vite project
   - Configure build settings:
     - **Build Command:** `npm run build`
     - **Output Directory:** `dist`
     - **Install Command:** `npm install`

3. **Add Environment Variables:**
   - In your Vercel dashboard, go to Project Settings → Environment Variables
   - Add: `VITE_OPENAI_API_KEY` with your OpenAI API key
   - Get your API key from: https://platform.openai.com/api-keys

4. **Deploy:**
   - Click "Deploy" - that's it!
   - Your app will be available at `https://your-project-name.vercel.app`

## 🥈 **Alternative: Netlify**

### Why Netlify?
- ✅ **Drag & drop** deployment from your `dist/` folder
- ✅ **Free tier** with good limits
- ✅ **Easy environment variables**

### Steps to Deploy on Netlify:

1. **Build your project:**
   ```bash
   npm run build
   ```

2. **Deploy:**
   - Go to [netlify.com](https://netlify.com) and sign up
   - Drag your `dist/` folder to the deploy area
   - Or connect your GitHub repo for automatic deployments

3. **Add Environment Variables:**
   - Go to Site Settings → Environment Variables
   - Add: `VITE_OPENAI_API_KEY` with your OpenAI API key

## 🥉 **GitHub Pages (Free but Limited)**

### Good for:
- ✅ **Completely free**
- ✅ **Simple static hosting**
- ❌ **No environment variables** (you'll need to handle API keys differently)

### Steps for GitHub Pages:

1. **Create a GitHub Actions workflow:**
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy to GitHub Pages
   
   on:
     push:
       branches: [ main ]
   
   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '18'
         - run: npm install
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

2. **Enable GitHub Pages:**
   - Go to your repo Settings → Pages
   - Source: GitHub Actions
   - Your site will be available at `https://yourusername.github.io/infainance`

## 🔧 **Local Testing**

Before deploying, test your production build locally:

```bash
# Build the project
npm run build

# Preview the production build
npm run preview
```

## 📝 **Environment Variables**

Create a `.env` file in your project root:

```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

**Important:** Never commit your `.env` file to version control!

## 🚨 **Important Notes**

1. **API Key Security:** Your OpenAI API key will be visible in the client-side code since it's a Vite environment variable. For production apps, consider using a backend proxy.

2. **File Size Limits:** Some platforms have file size limits for uploads. Your app processes Excel files in the browser, so this shouldn't be an issue.

3. **Browser Compatibility:** Your app uses modern JavaScript features. It works in all modern browsers (Chrome, Firefox, Safari, Edge).

## 🎯 **Quick Start (Recommended)**

**For the fastest deployment:**

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Connect your GitHub repo
4. Add your OpenAI API key as an environment variable
5. Click Deploy

**That's it!** Your app will be live in minutes.

## 🔍 **Troubleshooting**

### Common Issues:

1. **Build fails:** Make sure all dependencies are in `package.json`
2. **API key not working:** Check that the environment variable is named `VITE_OPENAI_API_KEY`
3. **App not loading:** Check the browser console for errors

### Getting Help:

- Check the deployment platform's documentation
- Look at the build logs for specific errors
- Test your build locally with `npm run build && npm run preview`
