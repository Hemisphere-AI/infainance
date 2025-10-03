


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Try to insert the user profile, but don't fail if it already exists
  INSERT INTO user_profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."spreadsheet_cells" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "spreadsheet_id" "uuid" NOT NULL,
    "row_index" integer NOT NULL,
    "col_index" integer NOT NULL,
    "formula" "text",
    "display_value" "text",
    "raw_value" numeric,
    "cell_type" "text" DEFAULT 'text'::"text",
    "number_format" "text",
    "decimal_places" integer,
    "is_currency" boolean DEFAULT false,
    "is_percentage" boolean DEFAULT false,
    "currency_symbol" "text",
    "is_date" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."spreadsheet_cells" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spreadsheets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Untitled Spreadsheet'::"text",
    "data" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."spreadsheets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "name" "text",
    "monthly_token_balance" integer DEFAULT 0,
    "token_reset_date" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."spreadsheet_cells"
    ADD CONSTRAINT "spreadsheet_cells_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spreadsheet_cells"
    ADD CONSTRAINT "spreadsheet_cells_spreadsheet_id_row_index_col_index_key" UNIQUE ("spreadsheet_id", "row_index", "col_index");



ALTER TABLE ONLY "public"."spreadsheets"
    ADD CONSTRAINT "spreadsheets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_spreadsheet_cells_position" ON "public"."spreadsheet_cells" USING "btree" ("spreadsheet_id", "row_index", "col_index");



CREATE INDEX "idx_spreadsheet_cells_spreadsheet_id" ON "public"."spreadsheet_cells" USING "btree" ("spreadsheet_id");



CREATE INDEX "idx_spreadsheets_updated_at" ON "public"."spreadsheets" USING "btree" ("updated_at");



CREATE INDEX "idx_spreadsheets_user_id" ON "public"."spreadsheets" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_email" ON "public"."user_profiles" USING "btree" ("email");



CREATE OR REPLACE TRIGGER "update_spreadsheet_cells_updated_at" BEFORE UPDATE ON "public"."spreadsheet_cells" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_spreadsheets_updated_at" BEFORE UPDATE ON "public"."spreadsheets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."spreadsheet_cells"
    ADD CONSTRAINT "spreadsheet_cells_spreadsheet_id_fkey" FOREIGN KEY ("spreadsheet_id") REFERENCES "public"."spreadsheets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spreadsheets"
    ADD CONSTRAINT "spreadsheets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete own spreadsheet cells" ON "public"."spreadsheet_cells" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."spreadsheets"
  WHERE (("spreadsheets"."id" = "spreadsheet_cells"."spreadsheet_id") AND ("spreadsheets"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own spreadsheets" ON "public"."spreadsheets" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own spreadsheet cells" ON "public"."spreadsheet_cells" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."spreadsheets"
  WHERE (("spreadsheets"."id" = "spreadsheet_cells"."spreadsheet_id") AND ("spreadsheets"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own spreadsheets" ON "public"."spreadsheets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own spreadsheet cells" ON "public"."spreadsheet_cells" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."spreadsheets"
  WHERE (("spreadsheets"."id" = "spreadsheet_cells"."spreadsheet_id") AND ("spreadsheets"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own spreadsheets" ON "public"."spreadsheets" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own spreadsheet cells" ON "public"."spreadsheet_cells" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."spreadsheets"
  WHERE (("spreadsheets"."id" = "spreadsheet_cells"."spreadsheet_id") AND ("spreadsheets"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own spreadsheets" ON "public"."spreadsheets" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."spreadsheet_cells" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spreadsheets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."spreadsheet_cells" TO "anon";
GRANT ALL ON TABLE "public"."spreadsheet_cells" TO "authenticated";
GRANT ALL ON TABLE "public"."spreadsheet_cells" TO "service_role";



GRANT ALL ON TABLE "public"."spreadsheets" TO "anon";
GRANT ALL ON TABLE "public"."spreadsheets" TO "authenticated";
GRANT ALL ON TABLE "public"."spreadsheets" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
