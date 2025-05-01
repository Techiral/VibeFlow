-- Create public schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS public;

-- Set privileges for the public schema
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Ensure auth schema exists and set privileges
-- (Supabase typically handles this, but good practice to include)
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;


-- ========= Tables ==========

-- Tokens Table (stores OAuth tokens)
CREATE TABLE public.tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider text NOT NULL, -- e.g., 'linkedin', 'twitter', 'composio'
    access_token text NOT NULL,
    refresh_token text NULL,
    expires_at timestamptz NULL,
    profile_metadata jsonb NULL, -- Store related profile info (name, handle, etc.)
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tokens_user_id ON public.tokens(user_id);
CREATE INDEX idx_tokens_provider ON public.tokens(provider);


-- Quotas Table (tracks user request usage)
CREATE TABLE public.quotas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    request_count integer NOT NULL DEFAULT 0,
    ip_address text NULL, -- Store last known IP for basic abuse detection
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quotas ENABLE ROW LEVEL SECURITY;
-- No separate index needed for user_id due to UNIQUE constraint


-- Failed Requests Table (logs errors for debugging)
CREATE TABLE public.failed_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL, -- Keep log even if user deleted
    created_at timestamptz NOT NULL DEFAULT now(),
    request_type text NOT NULL, -- e.g., 'summary', 'generate', 'publish', 'mcp_oauth'
    error_message text NOT NULL,
    request_payload jsonb NULL -- Optional: store input data causing the failure
);
ALTER TABLE public.failed_requests ENABLE ROW LEVEL SECURITY; -- Keep logs private initially
CREATE INDEX idx_failed_requests_user_id ON public.failed_requests(user_id);
CREATE INDEX idx_failed_requests_created_at ON public.failed_requests(created_at);


-- ========= Helper Functions ==========

-- Function to safely increment quota and check limit
CREATE OR REPLACE FUNCTION public.increment_quota(
    p_user_id uuid,
    p_increment_amount integer DEFAULT 1,
    p_ip_address text DEFAULT NULL
)
RETURNS integer -- Returns the new count
LANGUAGE plpgsql
SECURITY DEFINER -- Execute with privileges of the function owner (usually postgres)
SET search_path = public
AS $$
DECLARE
    v_current_count integer;
    v_max_quota integer := 100; -- Define the monthly quota limit
BEGIN
    -- Upsert quota record for the user if it doesn't exist
    INSERT INTO public.quotas (user_id, request_count, ip_address)
    VALUES (p_user_id, 0, p_ip_address)
    ON CONFLICT (user_id) DO NOTHING;

    -- Get the current count and lock the row
    SELECT request_count INTO v_current_count
    FROM public.quotas
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Check if quota is exceeded
    IF v_current_count + p_increment_amount > v_max_quota THEN
        RAISE EXCEPTION 'Quota exceeded for user %', p_user_id;
    END IF;

    -- Increment the count and update IP address
    UPDATE public.quotas
    SET request_count = request_count + p_increment_amount,
        ip_address = COALESCE(p_ip_address, ip_address) -- Update IP only if provided
    WHERE user_id = p_user_id
    RETURNING request_count INTO v_current_count;

    RETURN v_current_count;
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_quota(uuid, integer, text) TO authenticated;


-- Function to get remaining quota
CREATE OR REPLACE FUNCTION public.get_remaining_quota(
    p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_count integer;
    v_max_quota integer := 100;
BEGIN
    SELECT COALESCE(request_count, 0) INTO v_current_count
    FROM public.quotas
    WHERE user_id = p_user_id;

    RETURN v_max_quota - v_current_count;
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_remaining_quota(uuid) TO authenticated;


-- ========= RLS Policies ==========

-- tokens Table Policies
-- Users can view and manage their own tokens
CREATE POLICY "Allow users to manage own tokens"
    ON public.tokens
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- quotas Table Policies
-- Users can view their own quota (indirectly via get_remaining_quota function)
-- RLS for direct select can be restrictive as function provides controlled access
CREATE POLICY "Allow users to view own quota row (restricted)"
    ON public.quotas
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow controlled updates via increment_quota function (Security Definer)
-- No direct insert/update/delete policies for users on quotas table

-- failed_requests Table Policies
-- Initially, no access for users. Admins/service_role can access.
-- Policy for service_role (can be adjusted based on admin roles)
CREATE POLICY "Allow service_role full access to failed_requests"
    ON public.failed_requests
    FOR ALL
    USING (true) -- Or add specific role checks if needed
    WITH CHECK (true);


-- ========= Initial Data (Optional) ==========
-- (No initial data needed for these tables)


-- ========= Grant Permissions ==========
-- Grant necessary privileges on tables to roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tokens TO authenticated;
GRANT SELECT ON public.quotas TO authenticated; -- Select needed for function context

-- Grant usage on sequences if any (gen_random_uuid is built-in)

-- Grant permissions for service_role (used by server-side functions/scripts)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.failed_requests TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_quota(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_remaining_quota(uuid) TO service_role;

-- Grant anon role minimal access (usually just login functions via Supabase Auth)
-- Typically, anon doesn't need access to these app-specific tables directly.

-- Apply the changes
COMMIT;

-- Note: Remember to generate types after applying migrations:
-- npx supabase gen types typescript --project-id <your-project-ref> --schema public > src/types/supabase.ts
