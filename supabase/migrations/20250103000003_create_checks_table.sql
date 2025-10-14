-- Create checks table
-- This table stores user checks/entities that replace spreadsheets functionality

-- Step 1: Create checks table
CREATE TABLE IF NOT EXISTS "public"."checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active' NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Step 2: Add primary key
ALTER TABLE ONLY "public"."checks"
    ADD CONSTRAINT "checks_pkey" PRIMARY KEY ("id");

-- Step 3: Add foreign key constraint
ALTER TABLE ONLY "public"."checks"
    ADD CONSTRAINT "checks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;

-- Step 4: Add indexes for better performance
CREATE INDEX "idx_checks_user_id" ON "public"."checks" USING "btree" ("user_id");
CREATE INDEX "idx_checks_status" ON "public"."checks" USING "btree" ("status");
CREATE INDEX "idx_checks_created_at" ON "public"."checks" USING "btree" ("created_at");

-- Step 5: Add update trigger
CREATE OR REPLACE TRIGGER "update_checks_updated_at" BEFORE UPDATE ON "public"."checks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Step 6: Add RLS policies
ALTER TABLE "public"."checks" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own checks
CREATE POLICY "Users can view own checks" ON "public"."checks" FOR SELECT USING (("user_id" = "auth"."uid"()));

-- Policy: Users can insert their own checks
CREATE POLICY "Users can insert own checks" ON "public"."checks" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));

-- Policy: Users can update their own checks
CREATE POLICY "Users can update own checks" ON "public"."checks" FOR UPDATE USING (("user_id" = "auth"."uid"()));

-- Policy: Users can delete their own checks
CREATE POLICY "Users can delete own checks" ON "public"."checks" FOR DELETE USING (("user_id" = "auth"."uid"()));

-- Step 7: Add comments
COMMENT ON TABLE "public"."checks" IS 'Stores user checks/entities that replace spreadsheets functionality';
COMMENT ON COLUMN "public"."checks"."name" IS 'Check name (editable by user)';
COMMENT ON COLUMN "public"."checks"."description" IS 'Optional description of the check';
COMMENT ON COLUMN "public"."checks"."status" IS 'Check status: active, completed, cancelled';

-- Step 8: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."checks" TO authenticated;

-- Step 9: Verify the table was created
SELECT 
    'Checks table created successfully' as status,
    COUNT(*) as total_checks
FROM "public"."checks";
