# Backend API Server

This directory contains the backend API server for the Zenith Google Sheets integration.

## Files

- `server.js` - Main API server with Google Sheets integration
- `server.env` - Environment variables (create this file with your credentials)
- `package.json` - Backend dependencies and scripts

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp server.env.example server.env
   # Edit server.env with your Google Service Account credentials
   ```

3. **Start the server:**
   ```bash
   # Production
   npm start
   
   # Development (with auto-restart)
   npm run dev
   ```

## API Endpoints

- `GET /health` - Health check
- `GET /test` - Test endpoint
- `POST /api/sheets/create-for-user` - Create spreadsheet for user
- `GET /api/sheets/read` - Read spreadsheet data
- `POST /api/sheets/write` - Write data to spreadsheet
- `POST /api/sheets/batch-update` - Batch update multiple cells

## Environment Variables

See `documentation/SERVICE_ACCOUNT_SETUP.md` for detailed setup instructions.

Required variables:
- `GOOGLE_SA_PROJECT_ID`
- `GOOGLE_SA_CLIENT_EMAIL`
- `GOOGLE_SA_PRIVATE_KEY_ID`
- `GOOGLE_SA_PRIVATE_KEY`
- `GOOGLE_SHARED_DRIVE_ID`
- `GOOGLE_USER_SHEETS_FOLDER_ID`
- `PORT` (optional, defaults to 3001)
