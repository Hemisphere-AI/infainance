-- Remove google_sheet_url column from spreadsheets table
-- URLs are now computed from google_sheet_id in the frontend

-- Drop the google_sheet_url column
ALTER TABLE "public"."spreadsheets" DROP COLUMN IF EXISTS "google_sheet_url";

-- Add comment to document the change
COMMENT ON TABLE "public"."spreadsheets" IS 'Spreadsheet metadata. google_sheet_url is computed from google_sheet_id as https://docs.google.com/spreadsheets/d/{google_sheet_id}/edit';
