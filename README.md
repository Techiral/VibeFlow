# Firebase Studio - VibeFlow

This is a NextJS starter project called VibeFlow, built within Firebase Studio. It allows users to input content (URL or text), summarize it using AI, and generate tailored social media posts for different platforms (LinkedIn, Twitter, YouTube). Users can then tune these posts using AI suggestions.

## Getting Started

**🚨 Important:** If you are seeing errors like `relation "public.profiles" does not exist`, `function public.get_user_profile does not exist`, or other database-related issues, you **must** run the SQL commands in **Step 3** below. This step ensures your database schema is correctly set up and up-to-date.

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

    # Optional: Set the base URL if running behind a proxy or in a specific domain
    # NEXT_PUBLIC_BASE_URL=http://localhost:9002
    ```

    **Important:** Keep your API keys secure and do not commit `.env.local` to version control.

3.  **Set Up Supabase Database (MANDATORY):**

    You **must** run SQL commands to set up the necessary tables (`profiles`, `quotas`) and functions (`increment_quota`, `get_remaining_quota`, `get_user_profile`) in your Supabase project. If you skip this step or have an outdated schema, the application will **not** work correctly and you will see database errors like:
     * `relation "public.profiles" does not exist`
     * `relation "public.quotas" does not exist`
     * `function public.get_user_profile does not exist`
     * `function public.increment_quota does not exist`
     * `function public.get_remaining_quota does not exist`
     * `"could not find function ... in schema cache"`

    a.  Navigate to the **SQL Editor** in your Supabase project dashboard.
    b.  Click **+ New query**.
    c.  Paste and run the **entire** content of the SQL file found at `supabase/schema.sql`.

    **Idempotent Script:** This script is **idempotent**, meaning it can be run multiple times safely. It uses `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, and `ALTER TABLE ADD COLUMN IF NOT EXISTS` to ensure that:
        * If you are setting up for the first time, all necessary tables and functions will be created.
        * If you have run a previous version of this script, running the latest version will **safely add missing columns and update functions** without losing your existing data or causing "already exists" errors.

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

7.  **Add Gemini API Key:**
    Go to your profile settings (click the user icon in the dashboard) and add your Google Gemini API Key.
    *   Get a Gemini Key from [Google AI Studio](https://aistudio.google.com/app/apikey).

## Project Structure

-   `src/app/`: Contains the Next.js App Router pages and layouts.
    -   `dashboard/`: Dashboard related pages and components.
        - `page.tsx`: The main dashboard page (requires login).
        - `layout.tsx`: Layout for dashboard routes.
    -   `login/page.tsx`: The authentication page.
    -   `layout.tsx`: The root layout for the application.
    -   `api/`: API routes (e.g., health check).
    -   `auth/callback`: Route handler for Supabase auth callback.
-   `src/components/`: Reusable React components.
    -   `dashboard/`: Components specific to the dashboard UI.
        - `dashboard.tsx`: The core UI for content input and post generation.
        - `profile-dialog.tsx`: Dialog for managing user profile and settings (including API key).
        - `ai-advisor-panel.tsx`: Panel for displaying AI feedback on posts.
    -   `ui/`: ShadCN UI components.
-   `src/ai/`: Contains AI-related code using Genkit.
    -   `ai-instance.ts`: Configures the default Genkit instance.
    -   `flows/`: Defines the AI workflows (summarization, post generation, tuning, analysis).
        - `analyze-post.ts`: Flow for analyzing post drafts.
    -   `dev.ts`: Entry point for running Genkit flows in development mode.
-   `src/lib/`: Utility functions and library integrations.
    -   `supabase/`: Supabase client setup (client, server, middleware).
    -   `utils.ts`: General utility functions.
-   `src/services/`: Business logic services.
    - `content-parser.ts`: Parses content from URLs (placeholder).
    - `composio-service.ts`: (Removed Composio logic, file might be deleted).
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
-   **Profile Management:** Users can update their name, username, phone, and **Google Gemini API Key**.
-   **Content Input:** Accepts URLs or raw text.
-   **Persona Selection:** Choose an AI writing style (e.g., Tech CEO, Casual Gen Z).
-   **AI Summarization:** Uses Google Gemini via Genkit (user's API key) to summarize input content. Includes **auto-retry** for temporary API issues.
-   **Social Post Generation:** Generates posts for LinkedIn, Twitter, and YouTube based on the summary and selected persona (user's API key). Includes **auto-retry**.
-   **Post Tuning:** Refine generated posts with AI suggestions ("Make wittier", "More concise", etc.) (user's API key). Includes **auto-retry**.
-   **AI Advisor:** Analyzes generated posts for tone, clarity, and engagement, providing inline suggestions for improvement (user's API key). Includes **auto-retry**.
-   **Quota Management:** Tracks user requests against a monthly limit (100 requests/month). Displays usage in the profile. Disables generation/tuning/analysis when quota is exceeded. Includes retry logic for temporary API issues. Quota is refunded for failed AI operations.
-   **Gamification:** XP meter ("AI Fuel Tank") and unlockable badges for reaching generation milestones, with toast/confetti notifications.
-   **Rate Limiting & Queueing:** Handles API rate limits with auto-retry countdowns (future: optional request queueing).
-   **UI:** Built with Next.js App Router, React Server Components, ShadCN UI, and Tailwind CSS. Includes hover effects and subtle animations.
-   **Database:** Supabase PostgreSQL for user profiles, quotas, gamification data (XP/badges), etc.
-   **(Placeholder) Publishing:** UI elements for publishing posts (feature disabled).
-   **(Placeholder) Billing:** UI elements for upgrading plans (integration not yet implemented).
-   **(Optional) Onboarding:** A guided walkthrough for first-time users (react-joyride integration).

## Supabase Schema (`supabase/schema.sql`)

This file (`supabase/schema.sql`) contains the necessary SQL commands to set up your database. **You must execute this script in the Supabase SQL Editor** (see Step 3 in Getting Started). Failure to do so will result in application errors related to missing tables, functions, or columns (e.g., `relation "public.profiles" does not exist`).

**Important:** The script is **idempotent** (safe to run multiple times) using `CREATE OR REPLACE FUNCTION`, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`, etc. Running the latest version will update your schema without data loss.

```sql
-- Content of supabase/schema.sql (V3.2 - Composio Removed):
-- Supabase Schema Setup V3.2
-- This script can be run multiple times safely.

-- Drop dependent objects in the correct order
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_profile_update(); -- Now safe to drop
DROP FUNCTION IF EXISTS public.get_user_profile(uuid);
DROP FUNCTION IF EXISTS public.increment_quota(uuid, integer);
DROP FUNCTION IF EXISTS public.get_remaining_quota(uuid);


-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamp with time zone,
  username text UNIQUE,
  full_name text,
  phone_number text,
  gemini_api_key text, -- Consider encrypting this column in a real application
  xp integer DEFAULT 0, -- Added XP column
  badges text[] DEFAULT ARRAY[]::text[], -- Added badges column (array of text)
  -- Removed: composio_mcp_url, linkedin_url, twitter_url, youtube_url
  -- Removed: is_linkedin_authed, is_twitter_authed, is_youtube_authed
  -- Removed: composio_api_key
  -- Add length constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name_length CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist (more complex to check existence, ensure they match above)
-- Using DO block to check for constraint existence before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'username_length' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT username_length CHECK (char_length(username) <= 50);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'full_name_length' AND conrelid = 'public.profiles'::regclass
  ) THEN
     ALTER TABLE public.profiles ADD CONSTRAINT full_name_length CHECK (char_length(full_name) <= 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'phone_number_length' AND conrelid = 'public.profiles'::regclass
  ) THEN
     ALTER TABLE public.profiles ADD CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gemini_api_key_length' AND conrelid = 'public.profiles'::regclass
  ) THEN
     ALTER TABLE public.profiles ADD CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255);
  END IF;
END $$;


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


-- Policies for profiles table (DROP/CREATE for safety on re-run)
DROP POLICY IF EXISTS "Allow authenticated users to view own profile" ON public.profiles;
CREATE POLICY "Allow authenticated users to view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow authenticated users to update own profile" ON public.profiles;
CREATE POLICY "Allow authenticated users to update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger function to update updated_at timestamp (CREATE OR REPLACE is idempotent)
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger (DROP IF EXISTS was done at the top)
-- Ensure the trigger is created *after* the function it calls
CREATE TRIGGER on_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_profile_update();


-- 2. Quotas Table (Unchanged)
CREATE TABLE IF NOT EXISTS public.quotas (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count integer NOT NULL DEFAULT 0,
  last_reset_at timestamp with time zone NOT NULL DEFAULT now(),
  quota_limit integer NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address inet -- Optional: For tracking if needed
);

-- Add columns if they don't exist
ALTER TABLE public.quotas ADD COLUMN IF NOT EXISTS request_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.quotas ADD COLUMN IF NOT EXISTS last_reset_at timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE public.quotas ADD COLUMN IF NOT EXISTS quota_limit integer NOT NULL DEFAULT 100;
ALTER TABLE public.quotas ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE public.quotas ADD COLUMN IF NOT EXISTS ip_address inet;


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

-- Policies for quotas table (DROP/CREATE for safety)
DROP POLICY IF EXISTS "Allow authenticated users to view own quota" ON public.quotas;
CREATE POLICY "Allow authenticated users to view own quota"
  ON public.quotas FOR SELECT
  USING (auth.uid() = user_id);

-- Prevent direct modification - only allow via SECURITY DEFINER functions
DROP POLICY IF EXISTS "Allow insert for own quota" ON public.quotas;
DROP POLICY IF EXISTS "Allow update for own quota" ON public.quotas;


-- 3. get_user_profile Function (Upsert Logic, returns SETOF) - Updated for removed columns
-- CREATE OR REPLACE is idempotent
CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id uuid)
RETURNS SETOF public.profiles -- Return type matches the table structure
LANGUAGE plpgsql
SECURITY DEFINER -- Important: Allows the function to bypass RLS briefly for insert/update
SET search_path = public -- Ensures it uses the public schema
AS $$
DECLARE
  profile_record public.profiles;
BEGIN
  -- Try to select the profile first
  SELECT * INTO profile_record FROM public.profiles WHERE id = p_user_id;

  -- If profile doesn't exist, insert a new one with defaults
  IF NOT FOUND THEN
    RAISE NOTICE '[get_user_profile] Profile not found for user %, attempting to insert.', p_user_id;
    BEGIN
        -- Ensure all remaining default values are included (xp, badges)
        INSERT INTO public.profiles (id, updated_at, xp, badges)
        VALUES (p_user_id, now(), 0, ARRAY[]::text[])
        ON CONFLICT (id) DO NOTHING; -- Handle potential race conditions

        -- After attempting insert (even if conflict occurred), try selecting again
        SELECT * INTO profile_record FROM public.profiles WHERE id = p_user_id;

        IF NOT FOUND THEN
             RAISE WARNING '[get_user_profile] CRITICAL: Could not find or create profile for user % after insert attempt. Check permissions and auth triggers.', p_user_id;
             RETURN; -- Exit if still not found
        END IF;
         RAISE NOTICE '[get_user_profile] Profile found/created for user %.', p_user_id;

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[get_user_profile] Error during insert for user %: %', p_user_id, SQLERRM;
        -- Attempt to select again even if insert failed, maybe it exists now due to race condition
         SELECT * INTO profile_record FROM public.profiles WHERE id = p_user_id;
         IF NOT FOUND THEN
             RAISE WARNING '[get_user_profile] CRITICAL: Profile still not found for user % after insert error.', p_user_id;
             RETURN; -- Exit if still not found
         END IF;
    END;
  END IF;

  -- Return the found or newly created profile record
  RETURN NEXT profile_record;

END;
$$;

-- Grant execute permission to authenticated users (DROP/CREATE grant)
REVOKE EXECUTE ON FUNCTION public.get_user_profile(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO authenticated;


-- 4. increment_quota Function (Handles Reset and Increment, updates XP) - Unchanged logic
-- CREATE OR REPLACE is idempotent
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
  xp_gain integer := 0; -- XP gained in this operation
BEGIN
  -- Upsert quota record: Get current details or initialize if not exists
  INSERT INTO public.quotas (user_id, request_count, quota_limit, last_reset_at)
  VALUES (p_user_id, 0, 100, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    -- This forces fetching the actual current values if conflict occurs
    request_count = public.quotas.request_count
  RETURNING request_count, quota_limit, last_reset_at
  INTO current_count, current_limit, current_last_reset;

  -- If the INSERT happened (no conflict), fetch the values
   IF current_count IS NULL THEN
       SELECT q.request_count, q.quota_limit, q.last_reset_at
       INTO current_count, current_limit, current_last_reset
       FROM public.quotas q WHERE q.user_id = p_user_id;

       -- Handle case where user might have been deleted between checks (unlikely but safe)
       IF NOT FOUND THEN
          RAISE WARNING '[increment_quota] User % not found after insert/conflict.', p_user_id;
          RETURN -1; -- Indicate error
       END IF;
   END IF;

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
     xp_gain := 0; -- No XP gain if decrementing/correcting
  ELSIF p_increment_amount > 0 THEN
      xp_gain := p_increment_amount * 10; -- Calculate XP gain (10 per request)
  END IF;

  -- Update the quota record with the potentially reset/incremented values
  UPDATE public.quotas
  SET
    request_count = new_count,
    last_reset_at = current_last_reset -- Update reset time if it changed
  WHERE user_id = p_user_id;

   -- Update XP in the profiles table if XP was gained
   IF xp_gain > 0 THEN
       UPDATE public.profiles
       SET xp = COALESCE(xp, 0) + xp_gain
       WHERE id = p_user_id;
   END IF;

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

-- Grant execute permission (DROP/CREATE grant)
REVOKE EXECUTE ON FUNCTION public.increment_quota(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_quota(uuid, integer) TO authenticated;


-- 5. get_remaining_quota Function (Handles Reset Check) - Unchanged logic
-- CREATE OR REPLACE is idempotent
CREATE OR REPLACE FUNCTION public.get_remaining_quota(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER -- Allows bypassing RLS to potentially reset quota
AS $$
DECLARE
  current_count integer;
  current_limit integer;
  current_last_reset timestamp with time zone;
  remaining_quota integer;
  reset_occurred boolean := false;
BEGIN
  -- Get current quota details, initializing if necessary using the upsert logic from increment_quota
  INSERT INTO public.quotas (user_id, request_count, quota_limit, last_reset_at)
  VALUES (p_user_id, 0, 100, now())
  ON CONFLICT (user_id)
  DO NOTHING; -- Just ensure the row exists

  -- Fetch the current values after ensuring the row exists
  SELECT q.request_count, q.quota_limit, q.last_reset_at
  INTO current_count, current_limit, current_last_reset
  FROM public.quotas q
  WHERE q.user_id = p_user_id;

  -- Handle case where user might not exist (should be rare if auth is working)
  IF NOT FOUND THEN
      RAISE WARNING '[get_remaining_quota] Could not find quota record for user % even after insert attempt.', p_user_id;
      RETURN -1; -- Indicate error
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
  END IF;

  -- Calculate remaining quota based on current (potentially reset) count
  remaining_quota := current_limit - current_count;

  RETURN GREATEST(0, remaining_quota); -- Ensure it doesn't return negative

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[get_remaining_quota] Error for user %: %', p_user_id, SQLERRM;
        RETURN -1; -- Indicate an error occurred during calculation
END;
$$;

-- Grant execute permission (DROP/CREATE grant)
REVOKE EXECUTE ON FUNCTION public.get_remaining_quota(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_remaining_quota(uuid) TO authenticated;


-- 6. Optional Seed Steps (Commented out - Run manually if needed after initial setup)
/*
-- Seed initial profiles for existing users (run once after table creation) - Updated for removed columns
INSERT INTO public.profiles (id, updated_at, xp, badges)
SELECT id, NOW(), 0, ARRAY[]::text[] FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Seed initial quotas for existing users (run once after table creation)
INSERT INTO public.quotas (user_id, request_count, last_reset_at, quota_limit, created_at)
SELECT id, 0, NOW(), 100, NOW() FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
*/

RAISE NOTICE 'VibeFlow schema setup/update script completed (V3.2 - Composio Removed).';

force an update
```
```]></content>
  </change>
  <change>
    <file>package.json</file>
    <description>Remove composio-core dependency.</description>
    <content><![CDATA[{
  "name": "nextn",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack -p 9002",
    "genkit:dev": "genkit start -- tsx src/ai/dev.ts",
    "genkit:watch": "genkit start -- tsx --watch src/ai/dev.ts",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@genkit-ai/googleai": "^1.6.2",
    "@genkit-ai/next": "^1.6.2",
    "@hookform/resolvers": "^3.9.0",
    "@radix-ui/react-accordion": "^1.2.3",
    "@radix-ui/react-alert-dialog": "^1.1.6",
    "@radix-ui/react-avatar": "^1.1.3",
    "@radix-ui/react-checkbox": "^1.1.4",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-label": "^2.1.2",
    "@radix-ui/react-menubar": "^1.1.6",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-progress": "^1.1.2",
    "@radix-ui/react-radio-group": "^1.2.3",
    "@radix-ui/react-scroll-area": "^1.2.3",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-slider": "^1.2.3",
    "@radix-ui/react-slot": "^1.1.2",
    "@radix-ui/react-switch": "^1.1.3",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-toast": "^1.2.6",
    "@radix-ui/react-tooltip": "^1.1.8",
    "@supabase/ssr": "^0.4.0",
    "@tanstack-query-firebase/react": "^1.0.5",
    "@tanstack/react-query": "^5.66.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "firebase": "^11.3.0",
    "genkit": "^1.6.2",
    "lucide-react": "^0.475.0",
    "next": "15.2.3",
    "openai": "^4.53.2",
    "patch-package": "^8.0.0",
    "react": "^18.3.1",
    "react-confetti": "^6.1.0",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.54.2",
    "react-joyride": "^2.8.2",
    "recharts": "^2.15.1",
    "sonner": "^1.6.0",
    "tailwind-merge": "^3.0.1",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "genkit-cli": "^1.6.1",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
