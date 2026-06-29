-- Create a secure function to fetch global statistics for admins
CREATE OR REPLACE FUNCTION get_global_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_users integer;
BEGIN
    -- Check if the calling user is an admin
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Calculate stats
    SELECT COUNT(*) INTO total_users FROM user_profiles;

    RETURN json_build_object(
        'total_users', total_users
    );
END;
$$;
