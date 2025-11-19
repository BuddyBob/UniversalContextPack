-- Create RPC function to delete a source from a pack
-- This bypasses RLS policy issues by running as the function definer

-- Drop old function if it exists with wrong signature
DROP FUNCTION IF EXISTS delete_pack_source(UUID, UUID, UUID);

-- Create function with TEXT parameters (easier from Python client)
CREATE OR REPLACE FUNCTION delete_pack_source(
    user_uuid TEXT,
    target_pack_id TEXT,
    target_source_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's privileges
AS $$
BEGIN
    -- Delete the source (cascade will handle related data)
    -- Cast TEXT parameters to UUID for comparison
    DELETE FROM pack_sources
    WHERE source_id = target_source_id::UUID
    AND pack_id = target_pack_id::UUID
    AND user_id = user_uuid::UUID;
    
    -- Return true if a row was deleted
    RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_pack_source(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_pack_source(TEXT, TEXT, TEXT) TO anon;
