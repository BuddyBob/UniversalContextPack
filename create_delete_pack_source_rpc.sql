-- Create RPC function to delete a source from a pack
-- This bypasses RLS policy issues by running as the function definer

CREATE OR REPLACE FUNCTION delete_pack_source(
    user_uuid UUID,
    target_pack_id UUID,
    target_source_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's privileges
AS $$
BEGIN
    -- Delete the source (cascade will handle related data)
    DELETE FROM pack_sources
    WHERE source_id = target_source_id
    AND pack_id = target_pack_id
    AND user_id = user_uuid;
    
    -- Return true if a row was deleted
    RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_pack_source(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_pack_source(UUID, UUID, UUID) TO anon;
