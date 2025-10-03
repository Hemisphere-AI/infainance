# Supabase Setup Guide

This guide will help you set up Supabase for the database-backed spreadsheet application.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"
4. Choose your organization and enter project details:
   - Name: `infainance-spreadsheet`
   - Database Password: (generate a strong password)
   - Region: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be created (2-3 minutes)

## 2. Get Your Project Credentials

1. In your Supabase dashboard, go to Settings > API
2. Copy the following values:
   - Project URL (e.g., `https://your-project-id.supabase.co`)
   - Anon public key (starts with `eyJ...`)

## 3. Set Up Environment Variables

Create a `.env` file in your project root with:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key
VITE_OPENAI_API_KEY=your_openai_api_key
```

## 4. Set Up the Database Schema

1. In your Supabase dashboard, go to the SQL Editor
2. Copy and paste the contents of `database/schema.sql`
3. Click "Run" to execute the schema

## 5. Configure Authentication

1. In your Supabase dashboard, go to Authentication > Providers
2. Enable Google provider:
   - Toggle "Enable Google provider"
   - Add your Google OAuth credentials:
     - Client ID: (from Google Cloud Console)
     - Client Secret: (from Google Cloud Console)
3. Set the redirect URL to: `https://your-project-id.supabase.co/auth/v1/callback`

## 6. Set Up Google OAuth (if not already done)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `https://your-project-id.supabase.co/auth/v1/callback`
   - `http://localhost:3000` (for development)
7. Copy the Client ID and Client Secret to Supabase

## 7. Test the Setup

1. Start your development server: `npm run dev`
2. Navigate to your application
3. Try signing in with Google
4. Check that a new spreadsheet is created automatically

## Database Schema Overview

The application uses the following tables:

- **user_profiles**: Stores user information (extends Supabase auth.users)
- **spreadsheets**: Stores spreadsheet data with JSONB format
- **Row Level Security (RLS)**: Ensures users can only access their own data

## Real-time Features

The application includes real-time updates using Supabase's real-time subscriptions. When a user makes changes to a spreadsheet, other users viewing the same spreadsheet will see updates in real-time.

## Troubleshooting

### Common Issues:

1. **Authentication not working**: Check that Google OAuth is properly configured
2. **Database errors**: Ensure the schema was applied correctly
3. **Real-time not working**: Check that RLS policies are set up correctly

### Useful Commands:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('user_profiles', 'spreadsheets');

-- Test user creation
SELECT * FROM user_profiles LIMIT 5;
```

## Production Deployment

For production deployment:

1. Update environment variables with production Supabase credentials
2. Configure production Google OAuth redirect URLs
3. Set up proper CORS settings in Supabase
4. Consider setting up database backups and monitoring
