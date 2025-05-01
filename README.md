
# Firebase Studio - VibeFlow

This is a NextJS starter project called VibeFlow, built within Firebase Studio. It allows users to input content (URL or text), summarize it using AI, and generate tailored social media posts for different platforms (LinkedIn, Twitter, YouTube). Users can then tune these posts and (placeholder for) publish them.

## Getting Started

**🚨 Important:** If you are seeing errors like `relation "public.profiles" does not exist` or `function public.get_user_profile does not exist`, you **must** run the SQL commands in **Step 3** below.

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

3.  **Set Up Supabase Database (Required):**

    You **must** run SQL commands to set up the necessary tables (`profiles`, `quotas`) and functions (`increment_quota`, `get_remaining_quota`, `get_user_profile`) in your Supabase project. If you skip this step, the application will **not** work correctly and you will see database errors.

    a.  Navigate to the **SQL Editor** in your Supabase project dashboard.
    b.  Create a new query.
    c.  Paste and run the **entire** content of the SQL file found at `supabase/schema.sql`. This file contains commands to create the tables, functions, enable Row Level Security (RLS), and define security policies.

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
    Go to your profile settings (click the user icon in the dashboard) and add your Google Gemini API Key. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey).

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
        - `profile-dialog.tsx`: Dialog for managing user profile and settings.
    -   `ui/`: ShadCN UI components.
-   `src/ai/`: Contains AI-related code using Genkit.
    -   `ai-instance.ts`: Configures the default Genkit instance (may be less used now).
    -   `flows/`: Defines the AI workflows (summarization, post generation, tuning) which now accept API keys dynamically.
    -   `dev.ts`: Entry point for running Genkit flows in development mode.
-   `src/lib/`: Utility functions and library integrations.
    -   `supabase/`: Supabase client setup (client, server, middleware).
    -   `utils.ts`: General utility functions.
-   `src/services/`: Business logic services (e.g., content parsing).
-   `src/hooks/`: Custom React hooks (e.g., `useToast`, `useMobile`).
-   `src/types/`: TypeScript type definitions.
    -   `supabase.ts`: Auto-generated or manually defined Supabase database types.
-   `public/`: Static assets.
-   `middleware.ts`: Next.js middleware for Supabase session handling.
-   `supabase/`: Contains SQL schema and setup files.
    -   `schema.sql`: **(Crucial)** SQL commands for creating tables and functions. **Must be run in Supabase SQL Editor.**
-   `next.config.ts`: Next.js configuration.
-   `tailwind.config.ts`: Tailwind CSS configuration.
-   `tsconfig.json`: TypeScript configuration.
-   `components.json`: ShadCN UI configuration.

## Features

-   **Authentication:** Supabase Auth for user login/signup.
-   **Profile Management:** Users can update their name, username, phone, Composio URL, and crucially, their **Google Gemini API Key**.
-   **Content Input:** Accepts URLs or raw text.
-   **AI Summarization:** Uses Google Gemini via Genkit (using user's API key) to summarize input content.
-   **Social Post Generation:** Generates posts for LinkedIn, Twitter, and YouTube based on the summary (using user's API key).
-   **Post Tuning:** Allows users to refine generated posts with AI assistance (using user's API key).
-   **Quota Management:** Tracks user requests against a monthly limit (100 requests/month). Displays usage in the profile. Disables generation/tuning when quota is exceeded.
-   **UI:** Built with Next.js App Router, React Server Components, ShadCN UI, and Tailwind CSS.
-   **Database:** Supabase PostgreSQL for storing user profiles, quotas, and potentially other application data.
-   **(Placeholder) Publishing:** Includes UI elements for publishing posts (integration with Composio MCP is intended but not fully implemented).
-   **(Placeholder) Billing:** Includes UI elements for upgrading plans (billing integration not yet implemented).

## Supabase Schema (`supabase/schema.sql`)

This file (`supabase/schema.sql`) contains the necessary SQL commands to set up your database. **You must execute this script in the Supabase SQL Editor** (see Step 3 in Getting Started). Failure to do so will result in application errors related to missing tables or functions.

```sql
-- Content of supabase/schema.sql:
-- 1. Profiles Table
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamp with time zone,
  username text UNIQUE,
  full_name text,
  phone_number text,
  composio_url text,
  gemini_api_key text, -- Consider encrypting this column in a real application
  PRIMARY KEY (id),
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name_length CHECK (char_length(full_name) <= 100),
   CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
   CONSTRAINT composio_url_length CHECK (char_length(composio_url) <= 255),
   CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Allow authenticated users to update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_profile_update();


-- 2. Quotas Table
CREATE TABLE public.quotas (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count integer NOT NULL DEFAULT 0,
  last_reset_at timestamp with time zone NOT NULL DEFAULT now(),
  quota_limit integer NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address inet, -- Optional: For tracking if needed
  PRIMARY KEY (user_id) -- user_id is the primary key
);

ALTER TABLE public.quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view own quota"
  ON public.quotas FOR SELECT
  USING (auth.uid() = user_id);

-- Note: Updates to quota should ideally be handled by secure functions


-- 3. get_user_profile Function (Upsert Logic)
CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id uuid)
RETURNS SETOF public.profiles -- Return type matches the table
LANGUAGE plpgsql
SECURITY DEFINER -- Important: Allows the function to bypass RLS briefly for insert
SET search_path = public -- Ensures it uses the public schema
AS $$
DECLARE
  profile_record public.profiles;
BEGIN
  -- Try to select the profile
  SELECT * INTO profile_record FROM public.profiles WHERE id = p_user_id;

  -- If profile doesn't exist, insert a new one
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id) VALUES (p_user_id)
    RETURNING * INTO profile_record;
  END IF;

  -- Return the found or newly created profile
  RETURN NEXT profile_record;
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
  -- Get current quota details or initialize if not exists
  SELECT
    COALESCE(q.request_count, 0),
    COALESCE(q.quota_limit, 100), -- Default limit
    COALESCE(q.last_reset_at, now())
  INTO
    current_count,
    current_limit,
    current_last_reset
  FROM public.quotas q
  WHERE q.user_id = p_user_id;

  -- If no record exists, create one (should ideally be handled on profile creation/first fetch)
   IF NOT FOUND THEN
     INSERT INTO public.quotas (user_id, request_count, quota_limit, last_reset_at)
     VALUES (p_user_id, 0, 100, now())
     ON CONFLICT (user_id) DO NOTHING; -- Avoid race conditions

     -- Re-fetch after potential insert
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
   END IF;


  -- Check if a month has passed since the last reset
  IF current_last_reset < (now() - interval '1 month') THEN
    -- Reset the count and update the reset timestamp
    current_count := 0;
    current_last_reset := now();
  END IF;

  -- Calculate new count
  new_count := current_count + p_increment_amount;

   -- Check if increment exceeds limit (handle negative increments for corrections)
  IF new_count > current_limit AND p_increment_amount > 0 THEN
     RAISE EXCEPTION 'quota_exceeded'; -- Raise specific error
  END IF;

  -- Ensure count doesn't go below zero on correction
  IF new_count < 0 THEN
     new_count := 0;
  END IF;

  -- Update the quota record
  INSERT INTO public.quotas (user_id, request_count, last_reset_at, quota_limit)
  VALUES (p_user_id, new_count, current_last_reset, current_limit)
  ON CONFLICT (user_id)
  DO UPDATE SET
    request_count = EXCLUDED.request_count,
    last_reset_at = EXCLUDED.last_reset_at,
    quota_limit = EXCLUDED.quota_limit; -- Ensure limit is also updated if it changes

  -- Calculate remaining quota
  remaining_quota := current_limit - new_count;

  RETURN remaining_quota;

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error or handle it as needed
        RAISE WARNING 'Error in increment_quota for user %: %', p_user_id, SQLERRM;
        RAISE; -- Re-raise the original exception

END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_quota(uuid, integer) TO authenticated;


-- 5. get_remaining_quota Function (Handles Reset Check)
CREATE OR REPLACE FUNCTION public.get_remaining_quota(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count integer;
  current_limit integer;
  current_last_reset timestamp with time zone;
  remaining_quota integer;
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

   -- If no record exists, assume full quota
   IF NOT FOUND THEN
     RETURN 100; -- Or default limit
   END IF;

  -- Check if a month has passed
  IF current_last_reset < (now() - interval '1 month') THEN
    -- Quota should have been reset, return the full limit
    remaining_quota := current_limit;

     -- Optional: Update the record here if found to be outdated (or rely on increment function)
     UPDATE public.quotas
     SET request_count = 0, last_reset_at = now()
     WHERE user_id = p_user_id;

  ELSE
    -- Calculate remaining quota for the current period
    remaining_quota := current_limit - current_count;
  END IF;

  RETURN GREATEST(0, remaining_quota); -- Ensure it doesn't return negative

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_remaining_quota(uuid) TO authenticated;

-- 6. Seed initial profiles for existing users (Optional, run once after setup)
-- INSERT INTO public.profiles (id, updated_at)
-- SELECT id, NOW() FROM auth.users
-- ON CONFLICT (id) DO NOTHING;

-- 7. Seed initial quotas for existing users (Optional, run once after setup)
-- INSERT INTO public.quotas (user_id, last_reset_at, quota_limit)
-- SELECT id, NOW(), 100 FROM auth.users
-- ON CONFLICT (user_id) DO NOTHING;
```

**Security Note:** Storing API keys directly in the database (`profiles.gemini_api_key`) is generally **not recommended for production environments** without proper security measures like encryption at rest or using a secrets management service (like HashiCorp Vault or cloud provider secrets managers). For this hackathon project, it's a simplification.

