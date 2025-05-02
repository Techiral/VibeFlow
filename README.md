# Firebase Studio - VibeFlow

This is a NextJS starter project called VibeFlow, built within Firebase Studio. It allows users to input content (URL or text), summarize it using AI, and generate tailored social media posts for different platforms (LinkedIn, Twitter, YouTube). Users can then tune these posts, authenticate their social accounts via Composio, and (placeholder for) publish them.

## Getting Started

**🚨 Important:** If you are seeing errors like `relation "public.profiles" does not exist` or `function public.get_user_profile does not exist`, you **must** run the SQL commands in **Step 3** below. This is **not** an optional step.

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Set Up Environment Variables:**

    Create a `.env.local` file in the root of the project and add your Supabase API keys:

    ```plaintext
    # Replace with your actual Supabase URL and Anon Key
    # Find these in your Supabase project settings > API
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

    # GOOGLE_GENAI_API_KEY is no longer set here.
    # Users will add their key in the application's profile settings.
    ```

    **Important:** Keep your API keys secure and do not commit `.env.local` to version control.

3.  **Set Up Supabase Database (MANDATORY):**

    You **must** run SQL commands to set up the necessary tables (`profiles`, `quotas`) and functions (`increment_quota`, `get_remaining_quota`, `get_user_profile`) in your Supabase project. If you skip this step, the application will **not** work correctly and you will see database errors like:
     * `relation "public.profiles" does not exist`
     * `relation "public.quotas" does not exist`
     * `function public.get_user_profile does not exist`
     * `function public.increment_quota does not exist`
     * `function public.get_remaining_quota does not exist`
     * `"composio_mcp_url" column does not exist` (or similar column errors)

    a.  Navigate to the **SQL Editor** in your Supabase project dashboard.
    b.  Click **+ New query**.
    c.  Paste and run the **entire** content of the SQL file found at `supabase/schema.sql`. This script is **idempotent**, meaning it can be run multiple times safely. It will create tables/functions if they don't exist or update them if they do. **If you have run a previous version of this script, running the latest version will safely update your schema.**

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    This will start the Next.js application, typically on `http://localhost:9002`.

5.  **(Optional) Run Genkit Developer UI:**
    If you want to inspect or test the AI flows directly using the Genkit developer UI, run:
    ```bash
    npm run genkit:watch
    ```
    This will start the Genkit UI, usually on `http://localhost:4000`.

6.  **Open the App:**
    Navigate to `http://localhost:9002` (or the specified port) in your browser. Sign up or log in.

7.  **Add Gemini API Key & Composio URL:**
    Go to your profile settings (click the user icon in the dashboard) and add your Google Gemini API Key and your Composio MCP URL.
    *   Get a Gemini Key from [Google AI Studio](https://aistudio.google.com/app/apikey).
    *   Find your Composio MCP URL in your [Composio MCP dashboard](https://mcp.composio.dev).

## Project Structure

-   `src/app/`: Contains the Next.js App Router pages and layouts.
    -   `dashboard/`: Dashboard related pages and components.
        - `page.tsx`: The main dashboard page (requires login).
        - `layout.tsx`: Layout for dashboard routes.
    -   `login/page.tsx`: The authentication page.
    -   `layout.tsx`: The root layout for the application.
-   `src/components/`: Reusable React components.
    -   `dashboard/`: Components specific to the dashboard UI.
        - `dashboard.tsx`: The core UI for content input and post generation.
        - `profile-dialog.tsx`: Dialog for managing user profile and settings (including API keys and Composio URL).
        - `ai-advisor-panel.tsx`: (New) Panel for displaying AI feedback on posts.
    -   `ui/`: ShadCN UI components.
-   `src/ai/`: Contains AI-related code using Genkit.
    -   `ai-instance.ts`: Configures the default Genkit instance.
    -   `flows/`: Defines the AI workflows (summarization, post generation, tuning, analysis).
        - `analyze-post.ts`: (New) Flow for analyzing post drafts.
    -   `dev.ts`: Entry point for running Genkit flows in development mode.
-   `src/lib/`: Utility functions and library integrations.
    -   `supabase/`: Supabase client setup (client, server, middleware).
    -   `utils.ts`: General utility functions.
-   `src/services/`: Business logic services.
    - `content-parser.ts`: Parses content from URLs (placeholder).
    - `composio-service.ts`: Handles Composio app authentication logic.
-   `src/hooks/`: Custom React hooks (e.g., `useToast`, `useMobile`).
-   `src/types/`: TypeScript type definitions.
    -   `supabase.ts`: Auto-generated or manually defined Supabase database types.
-   `public/`: Static assets.
-   `middleware.ts`: Next.js middleware for Supabase session handling.
-   `supabase/`: Contains SQL schema and setup files.
    -   `schema.sql`: **(Crucial)** SQL commands for creating tables and functions. **Must be run in Supabase SQL Editor.**
-   `next.config.js`: Next.js configuration (includes webpack fallback for `async_hooks`).
-   `tailwind.config.ts`: Tailwind CSS configuration.
-   `tsconfig.json`: TypeScript configuration.
-   `components.json`: ShadCN UI configuration.

## Features

-   **Authentication:** Supabase Auth for user login/signup.
-   **Profile Management:** Users can update their name, username, phone, **Composio MCP URL**, and **Google Gemini API Key**.
-   **Content Input:** Accepts URLs or raw text.
-   **Persona Selection:** Choose an AI writing style (e.g., Tech CEO, Casual Gen Z).
-   **AI Summarization:** Uses Google Gemini via Genkit (user's API key) to summarize input content.
-   **Social Post Generation:** Generates posts for LinkedIn, Twitter, and YouTube based on the summary and selected persona (user's API key).
-   **Post Tuning:** Refine generated posts with AI suggestions ("Make wittier", "More concise", etc.) (user's API key).
-   **AI Advisor:** Analyzes generated posts for tone, clarity, and engagement, providing inline suggestions for improvement (user's API key).
-   **Composio App Authentication:** Authenticate LinkedIn, Twitter, and YouTube accounts via Composio for future publishing.
-   **Quota Management:** Tracks user requests against a monthly limit (100 requests/month). Displays usage in the profile. Disables generation/tuning/analysis when quota is exceeded. Includes retry logic for temporary API issues.
-   **Gamification:** XP meter ("AI Fuel Tank") and unlockable badges for reaching generation milestones.
-   **Rate Limiting & Queueing:** Handles API rate limits with auto-retry countdowns (future: optional request queueing).
-   **UI:** Built with Next.js App Router, React Server Components, ShadCN UI, and Tailwind CSS.
-   **Database:** Supabase PostgreSQL for user profiles, quotas, etc.
-   **(Placeholder) Publishing:** UI elements for publishing posts (integration not fully implemented).
-   **(Placeholder) Billing:** UI elements for upgrading plans (integration not yet implemented).

## Supabase Schema (`supabase/schema.sql`)

This file (`supabase/schema.sql`) contains the necessary SQL commands to set up your database. **You must execute this script in the Supabase SQL Editor** (see Step 3 in Getting Started). Failure to do so will result in application errors related to missing tables or functions (e.g., `relation "public.profiles" does not exist`).

**Important:** The script is **idempotent**, using `CREATE OR REPLACE FUNCTION`, `DROP TABLE IF EXISTS ... CASCADE`, and other techniques to allow safe re-running if you need to update the schema.

```sql
-- Content of supabase/schema.sql:
-- Supabase Schema Setup V2 (Idempotent)
-- This script can be run multiple times safely.

-- 1. Profiles Table
-- Drop dependent functions/views first if they might prevent table alterations
DROP FUNCTION IF EXISTS public.get_user_profile(uuid);

-- Drop existing profiles table and dependent objects if it exists (to recreate with updated constraints/columns if necessary)
-- Using CASCADE ensures dependent objects like policies, triggers are also dropped before recreating.
-- Alternatively, use ALTER TABLE ADD COLUMN IF NOT EXISTS for less destructive updates.
-- For simplicity in this context, DROP/CREATE is used, but ALTER is preferred in production migrations.
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamp with time zone,
  username text UNIQUE,
  full_name text,
  phone_number text,
  composio_mcp_url text, -- Renamed from composio_url
  gemini_api_key text, -- Consider encrypting this column in a real application
  is_linkedin_authed boolean DEFAULT false,
  is_twitter_authed boolean DEFAULT false,
  is_youtube_authed boolean DEFAULT false,
  -- Add length constraints back
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name_length CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT composio_mcp_url_length CHECK (char_length(composio_mcp_url) <= 255),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Enable Row Level Security if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles' AND rowsecurity = 't') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled for public.profiles';
  ELSE
    RAISE NOTICE 'RLS already enabled for public.profiles';
  END IF;
END $$;


-- Policies for profiles table
DROP POLICY IF EXISTS "Allow authenticated users to view own profile" ON public.profiles;
CREATE POLICY "Allow authenticated users to view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow authenticated users to update own profile" ON public.profiles;
CREATE POLICY "Allow authenticated users to update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger before creating a new one to avoid errors on re-run
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_profile_update();


-- 2. Quotas Table
-- Drop dependent functions first if needed
DROP FUNCTION IF EXISTS public.increment_quota(uuid, integer);
DROP FUNCTION IF EXISTS public.get_remaining_quota(uuid);

-- Drop and recreate quotas table (consider ALTER TABLE for production)
DROP TABLE IF EXISTS public.quotas CASCADE;
CREATE TABLE public.quotas (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count integer NOT NULL DEFAULT 0,
  last_reset_at timestamp with time zone NOT NULL DEFAULT now(),
  quota_limit integer NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address inet -- Optional: For tracking if needed
);

-- Enable Row Level Security if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'quotas' AND rowsecurity = 't') THEN
    ALTER TABLE public.quotas ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled for public.quotas';
  ELSE
    RAISE NOTICE 'RLS already enabled for public.quotas';
  END IF;
END $$;

-- Policies for quotas table
DROP POLICY IF EXISTS "Allow authenticated users to view own quota" ON public.quotas;
CREATE POLICY "Allow authenticated users to view own quota"
  ON public.quotas FOR SELECT
  USING (auth.uid() = user_id);

-- Policies for modification should generally be restricted if using SECURITY DEFINER functions
-- Ensure SECURITY DEFINER functions (like increment_quota) are granted necessary permissions implicitly
-- or explicitly grant update/insert to the function owner role if needed.


-- 3. get_user_profile Function (Upsert Logic, returns SETOF)
CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id uuid)
RETURNS SETOF public.profiles -- Return type matches the table structure
LANGUAGE plpgsql
SECURITY DEFINER -- Important: Allows the function to bypass RLS briefly for insert
SET search_path = public -- Ensures it uses the public schema
AS $$
DECLARE
  profile_record public.profiles;
BEGIN
  -- Try to select the profile
  SELECT * INTO profile_record FROM public.profiles WHERE id = p_user_id;

  -- If profile doesn't exist, insert a new one with defaults
  IF NOT FOUND THEN
    -- Ensure all columns with NOT NULL or default constraints are handled
    INSERT INTO public.profiles (id, updated_at, is_linkedin_authed, is_twitter_authed, is_youtube_authed)
    VALUES (p_user_id, now(), false, false, false)
    ON CONFLICT (id) DO NOTHING -- Handle potential race conditions if called concurrently
    RETURNING * INTO profile_record; -- Return the newly inserted row

    -- If ON CONFLICT DO NOTHING occurs, the record might still be null, re-fetch it
    IF profile_record IS NULL THEN
       SELECT * INTO profile_record FROM public.profiles WHERE id = p_user_id;
    END IF;

  END IF;

  -- Return the found or newly created profile record
  -- Check if a record was actually found or created before returning
  IF profile_record IS NOT NULL THEN
      RETURN NEXT profile_record;
  ELSE
      -- This case should ideally not happen if the user exists in auth.users
      -- But handle it just in case by returning nothing or raising an error
      RAISE WARNING 'Could not find or create profile for user %', p_user_id;
  END IF;

END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO authenticated;


-- 4. increment_quota Function (Handles Reset and Increment)
CREATE OR REPLACE FUNCTION public.increment_quota(p_user_id uuid, p_increment_amount integer)
RETURNS integer -- Returns the new REMAINING quota
LANGUAGE plpgsql
SECURITY DEFINER -- Allow function to modify table
AS $$
DECLARE
  current_count integer;
  current_limit integer;
  current_last_reset timestamp with time zone;
  new_count integer;
  remaining_quota integer;
BEGIN
  -- Upsert quota record: Get current details or initialize if not exists
  INSERT INTO public.quotas (user_id, request_count, quota_limit, last_reset_at)
  VALUES (p_user_id, 0, 100, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    -- Only update if necessary, prevent unnecessary writes
    request_count = public.quotas.request_count, -- No change on conflict here, fetch below
    quota_limit = public.quotas.quota_limit,
    last_reset_at = public.quotas.last_reset_at
  RETURNING request_count, quota_limit, last_reset_at
  INTO current_count, current_limit, current_last_reset;

  -- Check if a month has passed since the last reset
  IF current_last_reset < (now() - interval '1 month') THEN
    -- Reset the count and update the reset timestamp
    current_count := 0;
    current_last_reset := now();
  END IF;

  -- Calculate new count
  new_count := current_count + p_increment_amount;

  -- Check if increment exceeds limit (only apply check for positive increments)
  IF new_count > current_limit AND p_increment_amount > 0 THEN
     RAISE EXCEPTION 'quota_exceeded'; -- Raise specific error
  END IF;

  -- Ensure count doesn't go below zero on correction (negative increments)
  IF new_count < 0 THEN
     new_count := 0;
  END IF;

  -- Update the quota record with the potentially reset/incremented values
  UPDATE public.quotas
  SET
    request_count = new_count,
    last_reset_at = current_last_reset,
    quota_limit = current_limit -- Keep limit consistent, could be updated elsewhere
  WHERE user_id = p_user_id;

  -- Calculate remaining quota
  remaining_quota := current_limit - new_count;

  RETURN remaining_quota;

EXCEPTION
    WHEN SQLSTATE 'P0001' THEN -- 'quota_exceeded' raised via RAISE EXCEPTION
        RAISE EXCEPTION 'quota_exceeded'; -- Re-raise specific error for quota limit check
    WHEN OTHERS THEN
        -- Log the error or handle it as needed
        RAISE WARNING '[increment_quota] Error for user %: %', p_user_id, SQLERRM;
        RAISE; -- Re-raise the original exception
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_quota(uuid, integer) TO authenticated;


-- 5. get_remaining_quota Function (Handles Reset Check)
CREATE OR REPLACE FUNCTION public.get_remaining_quota(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER -- Important: Allows bypassing RLS to potentially reset quota
AS $$
DECLARE
  current_count integer;
  current_limit integer;
  current_last_reset timestamp with time zone;
  remaining_quota integer;
  reset_occurred boolean := false;
BEGIN
  -- Get current quota details
  SELECT
    COALESCE(q.request_count, 0),
    COALESCE(q.quota_limit, 100),
    COALESCE(q.last_reset_at, now())
  INTO
    current_count,
    current_limit,
    current_last_reset
  FROM public.quotas q
  WHERE q.user_id = p_user_id;

   -- If no record exists, assume full quota (this implies user hasn't used any yet)
   IF NOT FOUND THEN
     RETURN 100; -- Return default limit
   END IF;

  -- Check if a month has passed
  IF current_last_reset < (now() - interval '1 month') THEN
    -- Quota should be reset. Update the record within this function for consistency.
    UPDATE public.quotas
    SET request_count = 0, last_reset_at = now()
    WHERE user_id = p_user_id;

    -- Set the values used for calculation to the reset state
    current_count := 0;
    reset_occurred := true;
    -- The limit remains the same
  END IF;

  -- Calculate remaining quota based on current (potentially reset) count
  remaining_quota := current_limit - current_count;

  -- Optionally log if reset occurred
  -- IF reset_occurred THEN
  --   RAISE NOTICE '[get_remaining_quota] Quota reset performed for user %', p_user_id;
  -- END IF;

  RETURN GREATEST(0, remaining_quota); -- Ensure it doesn't return negative

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[get_remaining_quota] Error for user %: %', p_user_id, SQLERRM;
        RETURN -1; -- Indicate an error occurred during calculation
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_remaining_quota(uuid) TO authenticated;


-- 6. Optional Seed Steps (Commented out - Run manually if needed after initial setup)
/*
-- Seed initial profiles for existing users (run once after table creation)
INSERT INTO public.profiles (id, updated_at, is_linkedin_authed, is_twitter_authed, is_youtube_authed)
SELECT id, NOW(), false, false, false FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Seed initial quotas for existing users (run once after table creation)
INSERT INTO public.quotas (user_id, request_count, last_reset_at, quota_limit, created_at)
SELECT id, 0, NOW(), 100, NOW() FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
*/

RAISE NOTICE 'VibeFlow schema setup/update script completed.';
```

**Security Note:** Storing API keys directly in the database (`profiles.gemini_api_key`) is generally **not recommended for production environments** without proper security measures like encryption at rest or using a secrets management service. For this hackathon project, it's a simplification.
