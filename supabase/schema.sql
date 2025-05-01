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

-- Add INSERT policy for quotas
CREATE POLICY "Allow authenticated users to insert own quota"
  ON public.quotas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: Updates to quota should ideally be handled by secure functions (increment_quota)


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
    -- Temporarily bypass RLS for the insert operation within the function
    -- This requires the function owner (usually postgres) to have insert permissions.
    SET LOCAL role postgres; -- Or the appropriate superuser/owner role
    INSERT INTO public.profiles (id) VALUES (p_user_id);
    RESET role; -- Reset role back to the caller

    -- Re-fetch the newly inserted profile
    SELECT * INTO profile_record FROM public.profiles WHERE id = p_user_id;
  END IF;

  -- Return the found or newly created profile
  RETURN NEXT profile_record;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO authenticated;


-- 4. increment_quota Function (Handles Reset and Increment)
-- SECURITY DEFINER allows this function to bypass RLS if needed for updates
CREATE OR REPLACE FUNCTION public.increment_quota(p_user_id uuid, p_increment_amount integer)
RETURNS integer -- Returns the new REMAINING quota
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- This select runs as the calling user due to SECURITY DEFINER context,
  -- but the SELECT RLS policy allows them to see their own quota.
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

  -- If no record exists, create one using the INSERT policy
  -- The calling user (authenticated) must have permission via the INSERT RLS policy
   IF NOT FOUND THEN
     -- This INSERT runs as the calling user (authenticated)
     -- The INSERT RLS policy 'Allow authenticated users to insert own quota' must exist.
     INSERT INTO public.quotas (user_id, request_count, quota_limit, last_reset_at)
     VALUES (p_user_id, 0, 100, now())
     ON CONFLICT (user_id) DO NOTHING; -- Avoid race conditions if multiple calls happen

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

      -- Check if re-fetch failed (should not happen if INSERT policy is correct)
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Failed to create or find quota record for user % after initial insert attempt.', p_user_id;
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

   -- Check if increment exceeds limit (handle negative increments for corrections)
  IF new_count > current_limit AND p_increment_amount > 0 THEN
     RAISE EXCEPTION 'quota_exceeded'; -- Raise specific error
  END IF;

  -- Ensure count doesn't go below zero on correction
  IF new_count < 0 THEN
     new_count := 0;
  END IF;

  -- Update the quota record
  -- The SECURITY DEFINER context allows this UPDATE to bypass RLS,
  -- as long as the function owner (postgres) has UPDATE permission.
  -- This is generally safer than granting direct UPDATE RLS to users for quotas.
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
SECURITY DEFINER -- Allows reading potentially reset counts even if RLS hides it briefly
SET search_path = public
AS $$
DECLARE
  current_count integer;
  current_limit integer;
  current_last_reset timestamp with time zone;
  remaining_quota integer;
BEGIN
  -- Get current quota details
  -- SELECT runs as calling user, SELECT RLS policy must allow access
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

   -- If no record exists, assume full quota (should be rare after increment_quota logic)
   IF NOT FOUND THEN
     RETURN 100; -- Or default limit
   END IF;

  -- Check if a month has passed
  IF current_last_reset < (now() - interval '1 month') THEN
    -- Quota should have been reset, return the full limit
    remaining_quota := current_limit;

     -- Optional but recommended: Update the record here if found to be outdated
     -- This runs under SECURITY DEFINER, allowing the reset even if user can't directly UPDATE.
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


-- 6. Handle New User (Create Profile and Quota)
-- This trigger automatically creates a profile and quota entry when a new user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Needs elevated privileges to insert into tables
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id)
  VALUES (new.id);

  -- Insert into quotas table
  INSERT INTO public.quotas (user_id) -- Let defaults handle count, limit, reset time
  VALUES (new.id);

  RETURN new;
END;
$$;

-- Trigger after insert on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 7. Seed initial profiles for existing users (Optional, run once after setup if needed)
-- This might be useful if you set up the app before adding the handle_new_user trigger.
-- INSERT INTO public.profiles (id, updated_at)
-- SELECT id, NOW() FROM auth.users
-- ON CONFLICT (id) DO NOTHING;

-- 8. Seed initial quotas for existing users (Optional, run once after setup if needed)
-- Similar to seeding profiles, run if needed for users created before the trigger.
-- INSERT INTO public.quotas (user_id, last_reset_at, quota_limit)
-- SELECT id, NOW(), 100 FROM auth.users
-- ON CONFLICT (user_id) DO NOTHING;


-- 9. Add a Failed Requests Table (Optional but good practice)
CREATE TABLE public.failed_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    request_payload JSONB -- Store input data that caused the failure
);

ALTER TABLE public.failed_requests ENABLE ROW LEVEL SECURITY;

-- Allow admin/service role to view failed requests
CREATE POLICY "Allow admin read access to failed requests"
    ON public.failed_requests FOR SELECT
    USING (true); -- Adjust role/condition as needed

-- Allow service role (or function) to insert failed requests
CREATE POLICY "Allow service role insert access to failed requests"
    ON public.failed_requests FOR INSERT
    WITH CHECK (true); -- Adjust role/condition as needed
