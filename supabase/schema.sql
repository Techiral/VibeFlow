-- Content of supabase/schema.sql (V3.1 - Idempotent & Update-Friendly with Trigger Drop Order Fix)
-- Supabase Schema Setup V3.1
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
  composio_mcp_url text, -- For general Composio MCP link
  linkedin_url text, -- Specific URL if needed
  twitter_url text, -- Specific URL if needed
  youtube_url text, -- Specific URL if needed
  gemini_api_key text, -- Consider encrypting this column in a real application
  is_linkedin_authed boolean DEFAULT false,
  is_twitter_authed boolean DEFAULT false,
  is_youtube_authed boolean DEFAULT false,
  xp integer DEFAULT 0, -- Added XP column
  badges text[] DEFAULT ARRAY[]::text[], -- Added badges column (array of text)
  -- Add length constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name_length CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT composio_mcp_url_length CHECK (char_length(composio_mcp_url) <= 255),
  CONSTRAINT linkedin_url_length CHECK (char_length(linkedin_url) <= 255),
  CONSTRAINT twitter_url_length CHECK (char_length(twitter_url) <= 255),
  CONSTRAINT youtube_url_length CHECK (char_length(youtube_url) <= 255),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add columns if they don't exist (Safer than dropping/recreating)
-- Using ALTER TABLE ... ADD COLUMN IF NOT EXISTS
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS composio_mcp_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS twitter_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS youtube_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_linkedin_authed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_twitter_authed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_youtube_authed boolean DEFAULT false;
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
    WHERE conname = 'composio_mcp_url_length' AND conrelid = 'public.profiles'::regclass
  ) THEN
     ALTER TABLE public.profiles ADD CONSTRAINT composio_mcp_url_length CHECK (char_length(composio_mcp_url) <= 255);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'linkedin_url_length' AND conrelid = 'public.profiles'::regclass
  ) THEN
     ALTER TABLE public.profiles ADD CONSTRAINT linkedin_url_length CHECK (char_length(linkedin_url) <= 255);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'twitter_url_length' AND conrelid = 'public.profiles'::regclass
  ) THEN
     ALTER TABLE public.profiles ADD CONSTRAINT twitter_url_length CHECK (char_length(twitter_url) <= 255);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'youtube_url_length' AND conrelid = 'public.profiles'::regclass
  ) THEN
     ALTER TABLE public.profiles ADD CONSTRAINT youtube_url_length CHECK (char_length(youtube_url) <= 255);
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


-- 2. Quotas Table
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


-- 3. get_user_profile Function (Upsert Logic, returns SETOF)
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
        -- Ensure all default values are included, especially for new boolean/array/XP columns
        INSERT INTO public.profiles (id, updated_at, is_linkedin_authed, is_twitter_authed, is_youtube_authed, xp, badges)
        VALUES (p_user_id, now(), false, false, false, 0, ARRAY[]::text[])
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


-- 4. increment_quota Function (Handles Reset and Increment, updates XP)
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


-- 5. get_remaining_quota Function (Handles Reset Check)
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
-- Seed initial profiles for existing users (run once after table creation)
INSERT INTO public.profiles (id, updated_at, is_linkedin_authed, is_twitter_authed, is_youtube_authed, xp, badges)
SELECT id, NOW(), false, false, false, 0, ARRAY[]::text[] FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Seed initial quotas for existing users (run once after table creation)
INSERT INTO public.quotas (user_id, request_count, last_reset_at, quota_limit, created_at)
SELECT id, 0, NOW(), 100, NOW() FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
*/

RAISE NOTICE 'VibeFlow schema setup/update script completed (V3.1).';
