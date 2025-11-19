-- Create RPC function to delete a source from a pack
-- This bypasses RLS policy issues by running as the function definer
-- Matches delete_pack_v2 signature: user_uuid as UUID, other IDs as TEXT

-- Drop old function signatures if they exist
DROP FUNCTION IF EXISTS delete_pack_source(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS delete_pack_source(TEXT, TEXT, TEXT);

-- Create function with mixed parameters (UUID for user, TEXT for IDs - matches delete_pack_v2)
CREATE OR REPLACE FUNCTION delete_pack_source(
    user_uuid UUID,
    target_pack_id TEXT,
    target_source_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's privileges
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
    -- Delete the source (cascade will handle related data)
    DELETE FROM pack_sources
    WHERE source_id = target_source_id
    AND pack_id = target_pack_id
    AND user_id = user_uuid;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Return true if a row was deleted
    RETURN deleted_count > 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_pack_source(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_pack_source(UUID, TEXT, TEXT) TO anon;
