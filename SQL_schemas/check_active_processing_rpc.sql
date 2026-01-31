-- RPC function to check if user has active processing
-- This runs with SECURITY DEFINER to bypass row-level security
CREATE OR REPLACE FUNCTION check_user_has_active_processing(user_uuid UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    active_count INTEGER;
    result JSON;
BEGIN
    -- Count sources with active processing statuses
    SELECT COUNT(*)
    INTO active_count
    FROM pack_sources
    WHERE user_id = user_uuid
    AND status IN ('extracting', 'chunking', 'processing', 'analyzing', 'building_tree');
    
    -- Return JSON result
    result := json_build_object(
        'has_active_processing', active_count > 0,
        'active_count', active_count,
        'can_create_pack', active_count = 0
    );
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_user_has_active_processing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_has_active_processing(UUID) TO service_role;
