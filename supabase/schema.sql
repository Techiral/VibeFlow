
-- Ensure this script is idempotent, e.g., use CREATE TABLE IF NOT EXISTS or DROP/CREATE patterns carefully.

-- 1. Enable pg_cron extension if not already enabled (needed for potential future automated resets)
-- You might need to do this via the Supabase dashboard UI -> Database -> Extensions
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
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

-- Enable Row Level Security (RLS) if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for Profiles Table
DROP POLICY IF EXISTS "Allow authenticated users to view own profile" ON public.profiles;
CREATE POLICY "Allow authenticated users to view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow authenticated users to update own profile" ON public.profiles;
CREATE POLICY "Allow authenticated users to update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow new users to insert their own profile
DROP POLICY IF EXISTS "Allow authenticated users insert for own profile" ON public.profiles;
CREATE POLICY "Allow authenticated users insert for own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_profile_update();


-- 3. Quotas Table
CREATE TABLE IF NOT EXISTS public.quotas (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count integer NOT NULL DEFAULT 0,
  last_reset_at timestamp with time zone NOT NULL DEFAULT now(),
  quota_limit integer NOT NULL DEFAULT 100, -- Default monthly limit
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address inet, -- Optional: For tracking if needed, consider privacy implications
  PRIMARY KEY (user_id) -- user_id is the primary key
);

-- Enable RLS for Quotas
ALTER TABLE public.quotas ENABLE ROW LEVEL SECURITY;

-- Policies for Quotas Table
DROP POLICY IF EXISTS "Allow authenticated users to view own quota" ON public.quotas;
CREATE POLICY "Allow authenticated users to view own quota"
  ON public.quotas FOR SELECT
  USING (auth.uid() = user_id);

-- Allow service functions (like increment_quota) to update quota
-- Note: Direct updates by users should be disallowed or heavily restricted.
-- Policy for update might depend on how billing/upgrades work.
-- Example: Allow updates only via SECURITY DEFINER functions
DROP POLICY IF EXISTS "Disallow direct updates to quota" ON public.quotas;
CREATE POLICY "Disallow direct updates to quota"
  ON public.quotas FOR UPDATE
  USING (false); -- Disallow direct updates by default

DROP POLICY IF EXISTS "Allow insert for own quota (usually via function)" ON public.quotas;
CREATE POLICY "Allow insert for own quota (usually via function)"
  ON public.quotas FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- 4. get_user_profile Function (Upsert Logic)
-- Fetches a user's profile, creating one if it doesn't exist.
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
    -- Use a temporary bypass for RLS during insert IF NECESSARY.
    -- This depends on your specific RLS policies for INSERT.
    -- If the INSERT policy allows users to insert their own row, SECURITY DEFINER might not be strictly needed JUST for insert.
    -- However, keeping it consistent with increment_quota is often simpler.
    -- Be cautious with SECURITY DEFINER privileges.
    INSERT INTO public.profiles (id) VALUES (p_user_id)
    ON CONFLICT (id) DO NOTHING; -- Handle potential race conditions

     -- Re-fetch after insert attempt
     SELECT * INTO profile_record FROM public.profiles WHERE id = p_user_id;

  END IF;

  -- Return the found or newly created profile
  RETURN NEXT profile_record;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO authenticated;


-- 5. increment_quota Function (Handles Reset and Increment)
-- Safely increments the request count, checks limits, and handles monthly reset.
CREATE OR REPLACE FUNCTION public.increment_quota(p_user_id uuid, p_increment_amount integer)
RETURNS integer -- Returns the new REMAINING quota
LANGUAGE plpgsql
SECURITY DEFINER -- Allows function to modify table even if user RLS forbids direct update
SET search_path = public
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
    COALESCE(q.quota_limit, 100), -- Default limit if somehow null
    COALESCE(q.last_reset_at, now())
  INTO
    current_count,
    current_limit,
    current_last_reset
  FROM public.quotas q
  WHERE q.user_id = p_user_id;

  -- If no record exists, create one with defaults
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


  -- Check if a month (approximately 30 days for simplicity, adjust if needed) has passed since the last reset
  IF current_last_reset < (now() - interval '1 month') THEN
    -- Reset the count and update the reset timestamp
    current_count := 0;
    current_last_reset := now();
    RAISE LOG 'Quota reset for user %', p_user_id;
  END IF;

  -- Calculate new count
  new_count := current_count + p_increment_amount;

   -- Check if increment exceeds limit (only apply check for positive increments)
  IF p_increment_amount > 0 AND new_count > current_limit THEN
     RAISE EXCEPTION 'quota_exceeded'; -- Raise specific error code/message
  END IF;

  -- Ensure count doesn't go below zero (e.g., if correcting a previous error)
  IF new_count < 0 THEN
     new_count := 0;
  END IF;

  -- Update the quota record (or insert if it was just created implicitly)
  INSERT INTO public.quotas (user_id, request_count, last_reset_at, quota_limit)
  VALUES (p_user_id, new_count, current_last_reset, current_limit)
  ON CONFLICT (user_id)
  DO UPDATE SET
    request_count = EXCLUDED.request_count,
    last_reset_at = EXCLUDED.last_reset_at,
    quota_limit = EXCLUDED.quota_limit; -- Ensure limit is also updated if it changes

  -- Calculate remaining quota based on the NEW count
  remaining_quota := current_limit - new_count;

  RETURN remaining_quota;

EXCEPTION
    WHEN SQLSTATE 'P0001' THEN -- Catch custom exception 'quota_exceeded'
        RAISE WARNING 'Quota exceeded for user %', p_user_id;
        RAISE EXCEPTION 'quota_exceeded'; -- Re-raise the specific exception
    WHEN OTHERS THEN
        -- Log other errors
        RAISE WARNING 'Error in increment_quota for user %: %', p_user_id, SQLERRM;
        RAISE; -- Re-raise the original exception
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_quota(uuid, integer) TO authenticated;


-- 6. get_remaining_quota Function (Handles Reset Check)
-- Safely gets the remaining quota, performing a reset check if necessary.
CREATE OR REPLACE FUNCTION public.get_remaining_quota(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER -- Can potentially update the table if reset is needed
SET search_path = public
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

   -- If no record exists, assume full quota (consider creating the record here too for consistency)
   IF NOT FOUND THEN
      INSERT INTO public.quotas (user_id, request_count, quota_limit, last_reset_at)
      VALUES (p_user_id, 0, 100, now())
      ON CONFLICT (user_id) DO NOTHING;
      RETURN 100; -- Return default limit for new/missing user
   END IF;

  -- Check if a month has passed
  IF current_last_reset < (now() - interval '1 month') THEN
    -- Quota should be reset, return the full limit
    remaining_quota := current_limit;

     -- Update the record to reflect the reset state
     UPDATE public.quotas
     SET request_count = 0, last_reset_at = now()
     WHERE user_id = p_user_id;
     RAISE LOG 'Quota reset check performed for user %', p_user_id;

  ELSE
    -- Calculate remaining quota for the current period
    remaining_quota := current_limit - current_count;
  END IF;

  RETURN GREATEST(0, remaining_quota); -- Ensure it doesn't return negative

END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_remaining_quota(uuid) TO authenticated;

-- Optional Seed Data (Uncomment and run carefully after initial setup if needed)
-- Ensure existing users have a profile entry
-- INSERT INTO public.profiles (id, updated_at)
-- SELECT id, NOW() FROM auth.users
-- ON CONFLICT (id) DO NOTHING;

-- Ensure existing users have a quota entry
-- INSERT INTO public.quotas (user_id, last_reset_at, quota_limit)
-- SELECT id, NOW(), 100 FROM auth.users
-- ON CONFLICT (user_id) DO NOTHING;
