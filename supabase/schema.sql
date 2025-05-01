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
