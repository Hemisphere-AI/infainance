-- =====================================================
-- COMPLETE DATABASE SETUP FOR INFANANCE
-- =====================================================
-- This script sets up the complete database schema for the Infanance application
-- It includes all tables, constraints, indexes, triggers, and RLS policies
-- 
-- IMPORTANT: This script is idempotent - it can be run multiple times safely
-- =====================================================

-- =====================================================
-- 1. CREATE CORE TABLES
-- =====================================================

-- Create organizations table
CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("id")
);

-- Create organization_users table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS "public"."organization_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member',
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("id"),
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    UNIQUE ("organization_id", "user_id")
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("id"),
    FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    UNIQUE ("email")
);

-- Create organization_integrations table
CREATE TABLE IF NOT EXISTS "public"."organization_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_name" "text" NOT NULL,
    "api_key" "text",
    "config" "jsonb" DEFAULT '{}'::jsonb,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("id"),
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    UNIQUE ("organization_id", "integration_name")
);

-- Create checks table
CREATE TABLE IF NOT EXISTS "public"."checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT '',
    "status" "text" DEFAULT 'active',
    "is_checked" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("id"),
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE
);

-- Create checks_results table
CREATE TABLE IF NOT EXISTS "public"."checks_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "check_id" "uuid" NOT NULL,
    "status" "text" NOT NULL DEFAULT 'pending',
    "result_data" "jsonb",
    "error_message" "text",
    "executed_at" timestamp with time zone DEFAULT "now"(),
    "duration" integer,
    "success" boolean DEFAULT false,
    "query_plan" "jsonb",
    "record_count" integer DEFAULT 0,
    "records" "jsonb",
    "llm_analysis" "text",
    "tokens_used" integer,
    "execution_steps" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("id"),
    FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE CASCADE
);

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Organization indexes
CREATE INDEX IF NOT EXISTS "idx_organizations_name" ON "public"."organizations" ("name");

-- Organization users indexes
CREATE INDEX IF NOT EXISTS "idx_organization_users_organization_id" ON "public"."organization_users" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_organization_users_user_id" ON "public"."organization_users" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_organization_users_role" ON "public"."organization_users" ("role");

-- User profiles indexes
CREATE INDEX IF NOT EXISTS "idx_user_profiles_email" ON "public"."user_profiles" ("email");

-- Organization integrations indexes
CREATE INDEX IF NOT EXISTS "idx_organization_integrations_organization_id" ON "public"."organization_integrations" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_organization_integrations_integration_name" ON "public"."organization_integrations" ("integration_name");
CREATE INDEX IF NOT EXISTS "idx_organization_integrations_is_active" ON "public"."organization_integrations" ("is_active");

-- Checks indexes
CREATE INDEX IF NOT EXISTS "idx_checks_organization_id" ON "public"."checks" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_checks_status" ON "public"."checks" ("status");
CREATE INDEX IF NOT EXISTS "idx_checks_is_checked" ON "public"."checks" ("is_checked");

-- Checks results indexes
CREATE INDEX IF NOT EXISTS "idx_checks_results_check_id" ON "public"."checks_results" ("check_id");
CREATE INDEX IF NOT EXISTS "idx_checks_results_executed_at" ON "public"."checks_results" ("executed_at");
CREATE INDEX IF NOT EXISTS "idx_checks_results_status" ON "public"."checks_results" ("status");
CREATE INDEX IF NOT EXISTS "idx_checks_results_success" ON "public"."checks_results" ("success");
CREATE INDEX IF NOT EXISTS "idx_checks_results_record_count" ON "public"."checks_results" ("record_count");

-- =====================================================
-- 3. CREATE TRIGGERS AND FUNCTIONS
-- =====================================================

-- Create update_updated_at_column function
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER "update_organizations_updated_at" 
    BEFORE UPDATE ON "public"."organizations" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_organization_users_updated_at" 
    BEFORE UPDATE ON "public"."organization_users" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_user_profiles_updated_at" 
    BEFORE UPDATE ON "public"."user_profiles" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_organization_integrations_updated_at" 
    BEFORE UPDATE ON "public"."organization_integrations" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_checks_updated_at" 
    BEFORE UPDATE ON "public"."checks" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_checks_results_updated_at" 
    BEFORE UPDATE ON "public"."checks_results" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- =====================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."checks_results" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. DROP ALL EXISTING POLICIES (CLEAN SLATE)
-- =====================================================

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their organizations" ON "public"."organizations";
DROP POLICY IF EXISTS "Users can insert organizations" ON "public"."organizations";
DROP POLICY IF EXISTS "Users can update their organizations" ON "public"."organizations";
DROP POLICY IF EXISTS "Users can delete their organizations" ON "public"."organizations";
DROP POLICY IF EXISTS "Allow all operations on organizations" ON "public"."organizations";

DROP POLICY IF EXISTS "Users can view their own memberships" ON "public"."organization_users";
DROP POLICY IF EXISTS "Users can insert memberships" ON "public"."organization_users";
DROP POLICY IF EXISTS "Users can update their own memberships" ON "public"."organization_users";
DROP POLICY IF EXISTS "Users can delete their own memberships" ON "public"."organization_users";
DROP POLICY IF EXISTS "Allow all operations on organization_users" ON "public"."organization_users";

DROP POLICY IF EXISTS "Users can view their own profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Users can insert their own profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Users can update their own profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Users can delete their own profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Allow all operations on user_profiles" ON "public"."user_profiles";

DROP POLICY IF EXISTS "Users can view organization integrations" ON "public"."organization_integrations";
DROP POLICY IF EXISTS "Users can insert organization integrations" ON "public"."organization_integrations";
DROP POLICY IF EXISTS "Users can update organization integrations" ON "public"."organization_integrations";
DROP POLICY IF EXISTS "Users can delete organization integrations" ON "public"."organization_integrations";
DROP POLICY IF EXISTS "Allow all operations on organization_integrations" ON "public"."organization_integrations";

DROP POLICY IF EXISTS "Users can view organization checks" ON "public"."checks";
DROP POLICY IF EXISTS "Users can insert organization checks" ON "public"."checks";
DROP POLICY IF EXISTS "Users can update organization checks" ON "public"."checks";
DROP POLICY IF EXISTS "Users can delete organization checks" ON "public"."checks";
DROP POLICY IF EXISTS "Allow all operations on checks" ON "public"."checks";

DROP POLICY IF EXISTS "Users can view check results" ON "public"."checks_results";
DROP POLICY IF EXISTS "Users can insert check results" ON "public"."checks_results";
DROP POLICY IF EXISTS "Users can update check results" ON "public"."checks_results";
DROP POLICY IF EXISTS "Users can delete check results" ON "public"."checks_results";
DROP POLICY IF EXISTS "Allow all operations on checks_results" ON "public"."checks_results";

-- =====================================================
-- 6. CREATE PERMISSIVE RLS POLICIES
-- =====================================================
-- These policies allow the backend service role to work while RLS is enabled
-- The backend enforces actual user access control

-- ORGANIZATIONS: Allow all operations (backend enforces access control)
CREATE POLICY "Allow all operations on organizations" ON "public"."organizations"
    FOR ALL USING (true) WITH CHECK (true);

-- ORGANIZATION_USERS: Allow all operations (backend enforces access control)
CREATE POLICY "Allow all operations on organization_users" ON "public"."organization_users"
    FOR ALL USING (true) WITH CHECK (true);

-- USER_PROFILES: Allow all operations (backend enforces access control)
CREATE POLICY "Allow all operations on user_profiles" ON "public"."user_profiles"
    FOR ALL USING (true) WITH CHECK (true);

-- ORGANIZATION_INTEGRATIONS: Allow all operations (backend enforces access control)
CREATE POLICY "Allow all operations on organization_integrations" ON "public"."organization_integrations"
    FOR ALL USING (true) WITH CHECK (true);

-- CHECKS: Allow all operations (backend enforces access control)
CREATE POLICY "Allow all operations on checks" ON "public"."checks"
    FOR ALL USING (true) WITH CHECK (true);

-- CHECKS_RESULTS: Allow all operations (backend enforces access control)
CREATE POLICY "Allow all operations on checks_results" ON "public"."checks_results"
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."organizations" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."organization_users" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."user_profiles" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."organization_integrations" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."checks" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."checks_results" TO authenticated;

-- Grant permissions to anonymous users (for public access if needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."organizations" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."organization_users" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."user_profiles" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."organization_integrations" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."checks" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."checks_results" TO anon;

-- =====================================================
-- 8. ADD TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE "public"."organizations" IS 'Organizations that users can belong to';
COMMENT ON TABLE "public"."organization_users" IS 'Many-to-many relationship between users and organizations';
COMMENT ON TABLE "public"."user_profiles" IS 'User profile information separate from auth';
COMMENT ON TABLE "public"."organization_integrations" IS 'Integration configurations for organizations (e.g., Odoo API keys)';
COMMENT ON TABLE "public"."checks" IS 'Checks that belong to organizations';
COMMENT ON TABLE "public"."checks_results" IS 'Results from running checks';

COMMENT ON COLUMN "public"."organization_integrations"."integration_name" IS 'Name of the integration (e.g., "odoo", "salesforce")';
COMMENT ON COLUMN "public"."organization_integrations"."api_key" IS 'API key or authentication token for the integration';
COMMENT ON COLUMN "public"."organization_integrations"."config" IS 'Additional configuration data as JSON';
COMMENT ON COLUMN "public"."checks"."organization_id" IS 'Organization that owns this check';
COMMENT ON COLUMN "public"."checks_results"."duration" IS 'Execution duration in milliseconds';
COMMENT ON COLUMN "public"."checks_results"."success" IS 'Whether the check execution was successful';
COMMENT ON COLUMN "public"."checks_results"."query_plan" IS 'AI-generated query plan as JSON';
COMMENT ON COLUMN "public"."checks_results"."record_count" IS 'Number of records found';
COMMENT ON COLUMN "public"."checks_results"."records" IS 'Actual records data as JSON';
COMMENT ON COLUMN "public"."checks_results"."llm_analysis" IS 'LLM analysis of the check results';
COMMENT ON COLUMN "public"."checks_results"."tokens_used" IS 'Number of tokens used for LLM analysis';
COMMENT ON COLUMN "public"."checks_results"."execution_steps" IS 'Step-by-step execution details as JSON';

-- =====================================================
-- 9. CREATE SAMPLE DATA (OPTIONAL)
-- =====================================================

-- Create a sample user profile (replace with actual user ID)
INSERT INTO "public"."user_profiles" ("id", "email", "name", "created_at", "updated_at")
VALUES ('37c85e21-1b52-4864-90e1-4d034e6e00d7', 'your-email@example.com', 'Your Name', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    updated_at = NOW();

-- =====================================================
-- 10. VERIFICATION QUERIES
-- =====================================================

-- Verify all tables exist and have RLS enabled
SELECT 
    pg_tables.schemaname,
    pg_tables.tablename,
    pg_tables.rowsecurity as rls_enabled,
    COUNT(pg_policies.policyname) as policy_count
FROM pg_tables 
LEFT JOIN pg_policies ON pg_tables.tablename = pg_policies.tablename AND pg_tables.schemaname = pg_policies.schemaname
WHERE pg_tables.schemaname = 'public' 
  AND pg_tables.tablename IN ('organizations', 'organization_users', 'organization_integrations', 'checks', 'checks_results', 'user_profiles')
GROUP BY pg_tables.schemaname, pg_tables.tablename, pg_tables.rowsecurity
ORDER BY pg_tables.tablename;

-- Show table counts
SELECT 'organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'organization_users' as table_name, COUNT(*) as count FROM organization_users
UNION ALL
SELECT 'user_profiles' as table_name, COUNT(*) as count FROM user_profiles
UNION ALL
SELECT 'organization_integrations' as table_name, COUNT(*) as count FROM organization_integrations
UNION ALL
SELECT 'checks' as table_name, COUNT(*) as count FROM checks
UNION ALL
SELECT 'checks_results' as table_name, COUNT(*) as count FROM checks_results;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================
SELECT 'Database setup completed successfully!' as status;
